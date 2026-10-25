import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleOutcome, BattleSideNear } from "../../src/bridge/index.ts";
import {
  BATTLE_LENGTH,
  MOMENTS,
  battleAt,
  fieldMeadow,
  menAt,
  newBattle,
  newMeadow,
  trooperWords,
} from "../../src/view/index.ts";

// Phase 37 M184–M186: a battle of history fought before the eye — its hosts drawn up, so many men
// to a figure, coming on, meeting, the beaten breaking and the fallen where they fell, as many as
// history says fell; the same moment always the same.

const side = (name: string, fielded: number, fallen: number, arm = "spear"): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  host: { arm, guard: "shield", mount: "" },
  kit: `${arm}s and hide shields, on foot`,
});

function near(
  outcome: BattleOutcome,
  a: BattleSideNear,
  d: BattleSideNear,
  ground: { hills?: boolean; river?: boolean; walls?: 0 | 1 | 2 } = {},
): BattleNear {
  return {
    event: `ev:0:${outcome}${a.fielded}`,
    war: "war:1",
    title: "The battle at the test land",
    cell: 1,
    land: "The test land",
    year: 100,
    attacker: a,
    defender: { ...d, color: [0.2, 0.3, 0.85] },
    won: outcome !== "held",
    outcome,
    civil: null,
    hills: ground.hills ?? false,
    river: ground.river ?? false,
    walls: ground.walls ?? 0,
    town: ground.walls ? "Testholt" : null,
    figure: null,
    plan: {
      seed: "test battle",
      ages: [
        { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
      ] as never,
      lineages: [],
    },
  };
}

test("each host is drawn as many figures as it had men, one for so many, in proportion", () => {
  const f = newBattle(near("field", side("Ash", 6000, 500), side("Elm", 1500, 300)), 360);
  assert.equal(f.per, Math.ceil(6000 / 360));
  assert.equal(f.hosts[0].n, Math.round(6000 / f.per));
  assert.equal(f.hosts[1].n, Math.round(1500 / f.per));
  assert.equal(f.troopers.length, f.hosts[0].n + f.hosts[1].n);
  // (A small battle: a figure for every man.)
  const small = newBattle(near("held", side("Ash", 40, 6), side("Elm", 30, 3)), 360);
  assert.equal(small.per, 1);
  assert.equal(small.troopers.length, 70);
});

test("as many fall as history says fell, so many men to a figure: the victors keep some standing", () => {
  // (On open ground, and at a seat's walls, where those on them throw down on the attackers;
  // bows on either side, the arrows' dead in their volleys.)
  const cases = [
    ...(["field", "held", "taken"] as const).map((outcome) => ({
      outcome,
      a: side("Ash", 6000, 540),
      d: side("Elm", 1300, 240),
      ground: { river: true },
    })),
    {
      outcome: "held" as const,
      a: side("Ash", 580, 89),
      d: side("Elm", 125, 40),
      ground: { walls: 1 as const },
    },
    {
      outcome: "field" as const,
      a: side("Ash", 3100, 377, "bow"),
      d: side("Elm", 2900, 711, "bow"),
      ground: {},
    },
    {
      outcome: "stormed" as const,
      a: side("Ash", 900, 61, "bow"),
      d: side("Elm", 300, 170),
      ground: { walls: 2 as const },
    },
  ];
  for (const { outcome, a, d, ground } of cases) {
    const f = newBattle(near(outcome, a, d, ground), 360),
      end = battleAt(f, BATTLE_LENGTH),
      men = menAt(f, end);
    assert.deepEqual(end.fallen, [f.hosts[0].falls, f.hosts[1].falls], outcome);
    assert.deepEqual(men.fallen, [a.fallen, d.fallen], outcome);
    assert.deepEqual(men.standing, [a.fielded - a.fallen, d.fielded - d.fallen], outcome);
    const victor = f.beaten === 0 ? 1 : 0;
    assert.ok(end.standing[victor]! > 0, `${outcome}: the victors stand`);
    // Before the lines meet none has fallen to a blow; by the rout the most have.
    const atMelee = battleAt(f, MOMENTS.melee);
    assert.ok(
      f.troopers.every((t) => t.by !== "blow" || t.falls! > MOMENTS.melee),
      "no blow before the lines meet",
    );
    assert.ok(atMelee.fallen[0] + atMelee.fallen[1] <= end.fallen[0] + end.fallen[1]);
  }
});

test("the same moment of a battle is always the same", () => {
  const n = near("taken", side("Ash", 3000, 200, "bow"), side("Elm", 2000, 400)),
    one = newBattle(n, 360),
    two = newBattle(n, 360);
  for (const s of [0, 21.5, 52, 77.7, 112, BATTLE_LENGTH])
    assert.equal(JSON.stringify(battleAt(one, s)), JSON.stringify(battleAt(two, s)), `at ${s}`);
  // (And looked at out of order, as the course is drawn back and forth.)
  const later = JSON.stringify(battleAt(one, 90));
  battleAt(one, 30);
  assert.equal(JSON.stringify(battleAt(one, 90)), later);
});

test("the hosts come on and meet: the fronts at the line together, both sides fighting", () => {
  const f = newBattle(near("field", side("Ash", 2000, 200), side("Elm", 1800, 260)), 360),
    start = battleAt(f, 0),
    meet = battleAt(f, MOMENTS.melee + 10),
    front = (now: typeof start, s: 0 | 1) =>
      s === 0
        ? Math.max(...now.troopers.filter((t) => t.side === 0 && t.act !== "fall").map((t) => t.x))
        : Math.min(...now.troopers.filter((t) => t.side === 1 && t.act !== "fall").map((t) => t.x));
  assert.ok(front(start, 1) - front(start, 0) > 25, "drawn up apart");
  assert.ok(Math.abs(front(meet, 1) - front(meet, 0)) < 3.5, "the fronts meet");
  for (const s of [0, 1] as const)
    assert.ok(
      meet.troopers.some((t) => t.side === s && t.act === "fight"),
      `side ${s} fights at the line`,
    );
  // The beaten run once broken; the victors' front goes after them.
  const rout = battleAt(f, MOMENTS.rout + 8);
  assert.ok(
    rout.troopers.some((t) => t.side === f.beaten && t.act === "flee"),
    "the beaten run",
  );
  assert.ok(
    f.troopers.some((t) => t.side !== f.beaten && t.pursues),
    "the victors give chase",
  );
});

test("arrows fall where a host bears bows, and strike those history says they struck", () => {
  const f = newBattle(near("field", side("Ash", 3000, 300, "bow"), side("Elm", 3000, 500)), 360);
  assert.ok(f.arrows.length > 0, "arrows loosed");
  const flying = battleAt(f, MOMENTS.arrows + 4).flying;
  assert.ok(flying.length > 0, "arrows in the air as they come on");
  for (const a of f.arrows.filter((x) => x.hits >= 0)) {
    const hit = f.troopers[a.hits]!;
    assert.equal(hit.by, "arrow");
    assert.ok(Math.abs(hit.falls! - (a.at + a.flight)) < 1e-6, "they fall as it strikes");
  }
});

test("a seat stormed: its gate broken, the victors through it into the town, the town burning", () => {
  const f = newBattle(
      near("stormed", side("Ash", 5000, 70), side("Elm", 200, 160), { walls: 2 }),
      360,
    ),
    wall = f.ground.wall!;
  assert.ok(wall, "the seat's walls");
  const end = battleAt(f, BATTLE_LENGTH);
  assert.equal(end.gate, 1);
  assert.ok(end.burning > 0.9);
  assert.ok(
    end.troopers.some((t) => t.side === 0 && t.x > wall.x + 4),
    "the attackers in the town",
  );
  // A siege laid: no gate broken, the besiegers' tents pitched.
  const siege = battleAt(
    newBattle(near("siege", side("Ash", 5000, 70), side("Elm", 200, 160), { walls: 1 }), 360),
    BATTLE_LENGTH,
  );
  assert.equal(siege.gate, 0);
  assert.ok(siege.camp > 0.9, "the siege's camp");
});

test("one who fought is told: their host, their rank and what became of them", () => {
  const f = newBattle(near("field", side("Ash", 2000, 300), side("Elm", 1800, 260)), 360),
    fell = f.troopers.find((t) => t.by === "blow")!,
    ran = f.troopers.find((t) => t.flees !== null && t.falls === null)!;
  assert.match(
    trooperWords(f, fell.id, 0),
    /^👁 A (spearman|banner's bearer) of the realm of (Ash|Elm), in the \w+ rank/,
  );
  assert.match(trooperWords(f, fell.id, 0), /waiting in the line/);
  assert.match(trooperWords(f, fell.id, BATTLE_LENGTH), /fell in the press/);
  assert.match(trooperWords(f, ran.id, BATTLE_LENGTH), /running from the field/);
});

test("the meadow made the field: no pool, no wood where the hosts go, bare in the river", () => {
  const n = near("field", side("Ash", 2000, 300), side("Elm", 1800, 260), { river: true }),
    f = newBattle(n, 360),
    meadow = newMeadow(n.plan, 0, n.plan.seed, true);
  fieldMeadow(f, meadow);
  assert.equal(meadow.pond, null);
  assert.ok(meadow.shrubs.every((s) => Math.abs(s.z) > 34 || Math.abs(s.x) > 64));
  const river = f.ground.river!;
  // (A cell's middle in the river: x = river.x, z = 0.)
  const cols = Math.round(140 / 5),
    i = Math.floor((0 + 45) / 5) * cols + Math.floor((river.x + 70) / 5);
  assert.equal(meadow.grass[i], 0);
});

test("powder and shot: volleys fired — a flash at each muzzle, smoke rolling off, no arrow in the air; cannon where powder is known (Phase 37 M188)", () => {
  const a = { ...side("Ash", 3000, 400, "musket"), cannon: true },
    d = side("Elm", 2600, 500, "musket"),
    f = newBattle(near("field", a, d), 360);
  assert.ok(f.arrows.length > 0 && f.arrows.every((x) => x.shot), "every one loosed a shot");
  const volley = battleAt(f, MOMENTS.arrows + 3);
  assert.equal(volley.flying.length, 0, "no arrow in the air");
  assert.ok(volley.smoke.length > 0, "powder smoke");
  assert.ok(
    f.arrows.every((x) => battleAt(f, x.at + 0.02).flashes.length > 0),
    "a muzzle's flash as each fires",
  );
  assert.ok(f.cannon.length >= 2 && f.cannon.every((c) => c.side === 0), "the attackers' cannon");
  assert.ok(
    f.cannon.every((c) => c.fires.every((t) => t < MOMENTS.melee)),
    "silent once the lines meet",
  );
  const fired = f.cannon[0]!.fires[0]!;
  assert.ok(battleAt(f, fired + 0.05).cannon[0]!.recoil > 0.8, "thrown back as it fires");
  // As many fall as history says, the most to shot; and those shot down are told so.
  const end = battleAt(f, BATTLE_LENGTH);
  assert.deepEqual(menAt(f, end).fallen, [400, 500]);
  assert.equal(
    f.troopers.filter((t) => t.side === 1 && t.by === "arrow").length,
    Math.round(f.hosts[1].falls * 0.45),
  );
  const shot = f.troopers.find((t) => t.side === 1 && t.by === "arrow")!;
  assert.match(
    trooperWords(f, shot.id, BATTLE_LENGTH),
    /^👁 A (musketeer|banner's bearer) of the realm of Elm, .*: fell to a musket ball\.$/,
  );
  assert.ok(f.moments.some((m) => m.words === "Volleys of shot ring out as they come"));
  // Riflemen: their dead fall to bullets.
  const r = newBattle(
      near("held", side("Ash", 2000, 300, "rifle"), side("Elm", 2000, 200, "rifle")),
      360,
    ),
    hit = r.troopers.find((t) => t.by === "arrow")!;
  assert.match(trooperWords(r, hit.id, BATTLE_LENGTH), /fell to a bullet\.$/);
  assert.equal(r.cannon.length, 0, "no cannon without powder known");
});

test("a seat's defenders stand its walls on foot, their horses within; in the open they ride", () => {
  const riders = (name: string, fielded: number, fallen: number): BattleSideNear => ({
    ...side(name, fielded, fallen, "sword"),
    host: { arm: "sword", guard: "shield", mount: "horse" },
  });
  const open = newBattle(near("field", riders("Ash", 5000, 70), riders("Elm", 2000, 160)), 360),
    walled = newBattle(
      near("siege", riders("Ash", 5000, 70), riders("Elm", 2000, 160), { walls: 2 }),
      360,
    );
  assert.deepEqual(
    open.hosts.map((h) => h.mounted),
    ["horse", "horse"],
  );
  assert.deepEqual(
    walled.hosts.map((h) => h.mounted),
    ["horse", null],
  );
});

test("the wider host's wings close about the other's flanks once the lines meet, and its dead fall there too", () => {
  const f = newBattle(near("field", side("Ash", 9000, 300), side("Elm", 1500, 600)), 360);
  assert.equal(f.wings?.side, 0, "the wider host wheels");
  const w = f.wings!,
    wing = f.troopers.filter((t) => t.side === 0 && Math.abs(t.z) > w.z && t.falls === null);
  assert.ok(wing.length > 20, `${wing.length} in its wings`);
  const before = battleAt(f, MOMENTS.melee),
    after = battleAt(f, MOMENTS.melee + 25),
    mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // Wheeled on past the line about the other's flank, turned to face it, never into its ranks.
  assert.ok(
    mean(wing.map((t) => after.troopers[t.id]!.x - before.troopers[t.id]!.x)) > 3,
    "the wings come on past the line",
  );
  for (const t of wing)
    assert.ok(Math.abs(after.troopers[t.id]!.z) >= w.z - 0.5, `${t.id} kept outside the flank`);
  assert.ok(
    mean(wing.map((t) => Math.abs(Math.cos(after.troopers[t.id]!.yaw)))) > 0.9,
    "the wings face the flank",
  );
  assert.ok(
    f.moments.some((m) => m.words === "The wings of the realm of Ash close about the realm of Elm"),
  );
  // The other's outermost files fall the more: the wings bite at its flanks.
  const elm = f.troopers.filter((t) => t.side === 1),
    reach = Math.max(...elm.map((t) => Math.abs(t.z))),
    outer = elm.filter((t) => Math.abs(t.z) > reach - 3.2),
    share = (ts: typeof elm) => ts.filter((t) => t.by === "blow").length / ts.length;
  assert.ok(share(outer) > share(elm), `${share(outer)} on the flanks against ${share(elm)}`);
  // As many fall as fell, still.
  assert.deepEqual(menAt(f, battleAt(f, BATTLE_LENGTH)).fallen, [300, 600]);
});

test("no wings close where the hosts are matched, at a seat's walls or across a river", () => {
  const big = side("Ash", 9000, 300),
    small = side("Elm", 1500, 600);
  assert.equal(
    newBattle(near("field", side("Ash", 2000, 200), side("Elm", 1800, 260)), 360).wings,
    null,
  );
  assert.equal(newBattle(near("siege", big, small, { walls: 2 }), 360).wings, null);
  assert.equal(newBattle(near("field", big, small, { river: true }), 360).wings, null);
  // (A defender's wider line closes about the attackers as well.)
  assert.equal(newBattle(near("held", small, big), 360).wings?.side, 1);
});

test("some of the fallen crawl back toward their own lines a while, leaving their blood along the way; counted fallen as they fall", () => {
  const f = newBattle(near("field", side("Ash", 3000, 600), side("Elm", 2600, 700)), 360),
    end = battleAt(f, BATTLE_LENGTH);
  // (One wounded: dragging themselves on a while after they fell, toward their own side.)
  const crawler = f.troopers.find(
    (t) =>
      t.falls !== null &&
      t.falls < MOMENTS.rout - 20 &&
      battleAt(f, t.falls + 3).troopers[t.id]!.crawl === 1,
  );
  assert.ok(crawler, "one of the wounded crawls");
  const at = (s: number) => battleAt(f, s).troopers[crawler.id]!,
    a = at(crawler.falls! + 2),
    b = at(crawler.falls! + 4);
  assert.equal(a.act, "fall");
  assert.ok(crawler.side === 0 ? b.x < a.x : b.x > a.x, "back toward their own lines");
  // They lie still at last, where they came to.
  const later = at(crawler.falls! + 20),
    last = at(crawler.falls! + 24);
  assert.equal(later.crawl, 0);
  assert.deepEqual([later.x, later.z], [last.x, last.z]);
  // Counted fallen from when they fell; the field's blood more than one pool for each.
  assert.equal(menAt(f, end).fallen[0] + menAt(f, end).fallen[1], 1300);
  assert.ok(end.blood.length > end.fallen[0] + end.fallen[1], "a trail of blood");
  assert.ok(
    f.troopers
      .filter((t) => t.by === "rout")
      .every((t) => battleAt(f, t.falls! + 3).troopers[t.id]!.crawl === 0),
    "those cut down running lie where they fell",
  );
});

test("at a seat's walls the attackers raise ladders against them as they rush them, thrown down where the walls held", () => {
  const held = newBattle(
      near("held", side("Ash", 5000, 300), side("Elm", 900, 80), { walls: 2 }),
      360,
    ),
    siege = newBattle(
      near("siege", side("Ash", 5000, 90), side("Elm", 900, 160), { walls: 1 }),
      360,
    );
  for (const f of [held, siege]) {
    assert.ok(f.ladders.length >= 2, "ladders brought");
    // (Either side of the gate, along the attackers' front.)
    for (const l of f.ladders) assert.ok(Math.abs(l.z) > f.ground.wall!.gate + 1, "off the gate");
    assert.equal(battleAt(f, MOMENTS.charge).ladders.length, 0, "none before they reach the walls");
    const up = battleAt(f, MOMENTS.melee + 6).ladders;
    assert.equal(up.length, f.ladders.length);
    for (const l of up) {
      assert.ok(l.rise > 0.9 && l.rise < Math.PI / 2, `leaning on the walls (${l.rise})`);
      // (Its top at the walls' face.)
      assert.ok(
        Math.abs(
          l.x +
            Math.cos(l.rise) * l.long -
            (f.ground.wall!.x - (f.ground.wall!.stone ? 0.7 : 0.21)),
        ) < 0.01,
      );
    }
  }
  const end = (f: typeof held) => battleAt(f, BATTLE_LENGTH).ladders;
  assert.ok(
    end(held).every((l) => l.rise > Math.PI - 0.05),
    "thrown down where the walls held",
  );
  assert.ok(
    end(siege).every((l) => l.rise < Math.PI / 2),
    "left standing where they did not",
  );
  assert.equal(
    newBattle(near("field", side("Ash", 5000, 300), side("Elm", 900, 80)), 360).ladders.length,
    0,
    "none in the open",
  );
});
