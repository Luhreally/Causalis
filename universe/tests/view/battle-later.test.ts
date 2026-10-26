import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleOutcome, BattleSideNear } from "../../src/bridge/index.ts";
import {
  BATTLE_LENGTH,
  FIELD,
  MOMENTS,
  battleAt,
  menAt,
  newBattle,
  trooperWords,
} from "../../src/view/index.ts";

// Phase 53 M220: the battles of the later arms (the magazine and since: the repeater, the
// self-loading rifle, the automatic): open order, rushes, the trench, fire without pause, a machine
// gun's team, smokeless powder, the walls, the armoured cars. Their numbers and their words.

const side = (
  name: string,
  fielded: number,
  fallen: number,
  arm: string,
  mount = "",
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  host: { arm, guard: "shield", mount },
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

test("in open order the hosts stand apart on foot with no banners: files three metres apart, no deeper than thirty", () => {
  const f = newBattle(
      near("field", side("Ash", 2400, 300, "repeater"), side("Elm", 2000, 260, "repeater")),
      360,
    ),
    now = battleAt(f, 0),
    files = f.troopers.filter((t) => t.side === 0 && t.rank === 0).sort((p, q) => p.z - q.z);
  assert.ok(
    f.hosts.every((h) => h.open),
    "both in open order",
  );
  assert.ok(
    f.hosts.every((h) => h.mounted === null),
    "on foot",
  );
  assert.ok(
    f.troopers.every((t) => !t.bearer),
    "no banners",
  );
  const gaps = files.slice(1).map((t, i) => t.z - files[i]!.z);
  assert.ok(
    gaps.every((g) => g >= 2 && g <= 4),
    `files about three metres apart (${Math.min(...gaps)} to ${Math.max(...gaps)})`,
  );
  for (const side of [0, 1] as const) {
    const xs = now.troopers.filter((t) => t.side === side).map((t) => t.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) <= 30 + 1e-9, `side ${side} no deeper than 30 m`);
  }
  // (A repeater host on horses fights on foot; a spear host on horses still rides.)
  assert.equal(
    newBattle(
      near("field", side("Ash", 2400, 300, "repeater", "cavalry"), side("Elm", 2000, 260, "spear")),
      360,
    ).hosts[0].mounted,
    null,
    "a repeater on cavalry is drawn on foot",
  );
  assert.equal(
    newBattle(
      near("field", side("Ash", 2400, 300, "spear", "cavalry"), side("Elm", 2000, 260, "spear")),
      360,
    ).hosts[0].mounted,
    "horse",
    "a spear host on cavalry still rides",
  );
});

test("attackers in open order come on in rushes: some running, the rest down in the grass between, none marching", () => {
  const f = newBattle(
      near("field", side("Ash", 2400, 300, "repeater"), side("Elm", 2000, 260, "spear")),
      360,
    ),
    acts = (s: number) =>
      battleAt(f, s)
        .troopers.filter((t) => t.side === 0)
        .map((t) => t.act),
    seconds = Array.from({ length: 60 }, (_, i) => 10 + i * 0.5);
  for (const s of seconds) assert.ok(!acts(s).includes("march"), `no march at ${s} s`);
  assert.ok(
    seconds.some((s) => s > 20 && s < 38 && acts(s).includes("run") && acts(s).includes("prone")),
    "running and down in the grass at once",
  );
});

test("defenders in open order dig a trench: the front rank stands sunk in it and fires, the rest lie behind", () => {
  const f = newBattle(
    near("field", side("Ash", 2400, 300, "rifle"), side("Elm", 2000, 260, "autoloader")),
    360,
  );
  assert.ok(f.ground.trench, "a trench dug");
  assert.equal(f.ground.trench!.x, f.meet + 1, "where the defenders stand");
  const now = battleAt(f, 30),
    front = f.troopers.filter(
      (t) => t.side === 1 && t.rank === 0 && (t.falls === null || t.falls > 30),
    );
  assert.ok(front.length > 0, "a front rank alive at 30 s");
  for (const t of front) {
    const n = now.troopers[t.id]!;
    assert.ok(n.y < -0.8, `${t.id} stands sunk in the trench (${n.y})`);
    assert.equal(n.act, "loose", `${t.id} fires from it`);
  }
  assert.ok(
    now.troopers.some((n) => n.side === 1 && n.act === "prone"),
    "the ranks behind lie down",
  );
  // (At the line they fight in it, still sunk.)
  const melee = battleAt(f, MOMENTS.melee + 10);
  for (const t of f.troopers.filter(
    (x) => x.side === 1 && x.rank === 0 && (x.falls === null || x.falls > MOMENTS.melee + 10),
  )) {
    assert.equal(melee.troopers[t.id]!.act, "fight", `${t.id} fights in the trench`);
    assert.ok(melee.troopers[t.id]!.y < -0.8, `${t.id} still sunk`);
  }
  assert.ok(
    f.moments.some((m) => m.words === "They fight in the trench"),
    "the moment is told",
  );
});

test("fire without pause: an autoloader side's shots fall in forty seconds or more, at most 700 a side, every one a shot; automatic v automatic: the falls as history says", () => {
  const al = newBattle(
      near("field", side("Ash", 2400, 300, "autoloader"), side("Elm", 2000, 260, "autoloader")),
      360,
    ),
    shots = al.arrows.filter((a) => a.side === 0);
  assert.ok(
    new Set(shots.map((a) => Math.floor(a.at))).size >= 40,
    "shots in forty seconds or more",
  );
  for (const s of [0, 1] as const)
    assert.ok(al.arrows.filter((a) => a.side === s).length <= 700, `side ${s}: at most 700 shots`);
  assert.ok(
    al.arrows.every((a) => a.shot),
    "every one a shot",
  );
  const au = newBattle(
      near("field", side("Ash", 2400, 300, "automatic"), side("Elm", 2000, 260, "automatic")),
      360,
    ),
    end = battleAt(au, BATTLE_LENGTH);
  assert.deepEqual(menAt(au, end).fallen, [300, 260], "the fallen as history says");
  for (const s of [0, 1] as const)
    assert.ok(
      au.troopers.filter((t) => t.side === s && t.falls !== null).length <= au.hosts[s].falls,
      `side ${s} no more figures fall than its falls`,
    );
});

test("a machine gun's team: gunners in the first two ranks, told as machine gunners, firing in bursts", () => {
  const f = newBattle(
      near("field", side("Ash", 2400, 300, "automatic"), side("Elm", 2000, 260, "spear")),
      360,
    ),
    gunners = f.troopers.filter((t) => t.side === 0 && t.gun);
  assert.ok(gunners.length > 0, "gunners drawn");
  assert.ok(
    gunners.every((t) => t.rank < 2 && t.file % 3 === 1),
    "the first two ranks, every third file",
  );
  const alive = gunners.find((t) => t.falls === null || t.falls > 30)!;
  assert.equal(battleAt(f, 30).troopers[alive.id]!.gun, true, "marked as a gun at 30 s");
  assert.match(
    trooperWords(f, alive.id, 30),
    /^👁 A machine gunner of the realm of Ash, in the \w+ rank/,
  );
  const rest = f.troopers.find(
    (t) => t.side === 0 && !t.gun && (t.falls === null || t.falls > 30),
  )!;
  assert.match(
    trooperWords(f, rest.id, 30),
    /^👁 A rifleman of the realm of Ash/,
    "the rest rifles",
  );
  // (Bursts: three rounds from one place inside half a second.)
  const places = new Map<string, number[]>();
  for (const a of f.arrows)
    if (a.side === 0) {
      const k = `${a.from.x}:${a.from.z}`;
      places.set(k, [...(places.get(k) ?? []), a.at]);
    }
  assert.ok(
    [...places.values()].some((ats) =>
      ats.some((at) => ats.filter((o) => o >= at && o < at + 0.5).length >= 3),
    ),
    "a gunner fires three rounds within half a second",
  );
  assert.ok(
    f.moments.some((m) => m.words === "Machine guns open up"),
    "the moment is told",
  );
});

test("smokeless powder: the self-loading rifles' smoke lies thinner, a puff at a time, than black powder's", () => {
  const smoke = (f: ReturnType<typeof newBattle>) => {
    const rs = battleAt(f, 30).smoke.map((p) => p.r);
    return rs.reduce((x, y) => x + y, 0) / rs.length;
  };
  const al = newBattle(
      near("field", side("Ash", 2400, 300, "autoloader"), side("Elm", 2000, 260, "autoloader")),
      360,
    ),
    mu = newBattle(
      near("field", side("Ash", 2400, 300, "musket"), side("Elm", 2000, 260, "musket")),
      360,
    );
  assert.ok(smoke(al) < smoke(mu), `${smoke(al)} against ${smoke(mu)}`);
});

test("at a seat's walls the self-loading rifle raises no ladders and blows the gate; the repeater still raises ladders", () => {
  const storm = (arm: string) =>
    newBattle(
      near("stormed", side("Ash", 5000, 70, arm), side("Elm", 200, 160, "spear"), { walls: 2 }),
      360,
    );
  const auto = storm("autoloader");
  assert.equal(auto.ladders.length, 0, "no ladders raised");
  assert.ok(
    auto.moments.some((m) => m.words === "The gate is blown in"),
    "the gate is blown in",
  );
  assert.ok(!auto.moments.some((m) => m.words === "The gate is broken"), "not broken");
  const rep = storm("repeater");
  assert.ok(rep.ladders.length >= 2, "ladders raised");
  assert.ok(
    rep.moments.some((m) => m.words === "The gate is broken"),
    "the gate is broken",
  );
});

test("armoured cars: on at an even pace, knocked out and burning, none past the field's edge; the moments tell of them", () => {
  const f = newBattle(
      near(
        "held",
        side("Ash", 2400, 600, "autoloader", "armoured"),
        side("Elm", 1800, 200, "rifle"),
      ),
      360,
    ),
    cars = f.vehicles!;
  assert.ok(cars.length > 0 && cars.length <= 16, `${cars.length} cars, at most sixteen`);
  assert.ok(
    cars.every((v) => v.side === 0),
    "only the armoured side brings them",
  );
  // (On at an even pace toward the foe between 10 s and 40 s.)
  const early = battleAt(f, 10).vehicles!,
    late = battleAt(f, 40).vehicles!;
  for (const v of cars)
    assert.ok(late[v.id]!.x > early[v.id]!.x + 10, `car ${v.id} comes on toward the foe`);
  // (Some knocked out by the end; the first burns, with fumes and flame.)
  assert.ok(
    battleAt(f, BATTLE_LENGTH).vehicles!.some((v) => v.knocked === 1),
    "some knocked out by the end",
  );
  const first = Math.min(...cars.map((v) => v.knocked ?? Infinity)),
    burn = battleAt(f, first + 5);
  assert.ok(
    burn.vehicles!.some((v) => v.burning > 0.9),
    "a wreck burning",
  );
  assert.ok(burn.fumes!.length >= 6 && burn.flames!.length >= 3, "its fumes and flame");
  for (let s = 0; s <= BATTLE_LENGTH; s += 5)
    for (const v of battleAt(f, s).vehicles!)
      assert.ok(Math.abs(v.x) <= FIELD.x + 20, `car ${v.id} at ${s} s is on the field`);
  assert.ok(
    f.moments.some((m) => m.words === "The armoured cars of the realm of Ash roll forward"),
    "the cars roll forward",
  );
  assert.ok(
    f.moments.some((m) => m.words === "An armoured car is knocked out, burning"),
    "the first knocked out",
  );
  for (let i = 1; i < f.moments.length; i++)
    assert.ok(f.moments[i]!.at >= f.moments[i - 1]!.at, "the moments are in time's order");
});

test("the same second of a battle in the later arms is the same every time", () => {
  const n = near(
      "held",
      side("Ash", 2400, 600, "automatic", "armoured"),
      side("Elm", 1800, 200, "autoloader"),
    ),
    one = newBattle(n, 360),
    two = newBattle(n, 360);
  for (const s of [0, 12.5, 30, 52, 77.7, 110, 140, BATTLE_LENGTH])
    assert.deepEqual(battleAt(one, s), battleAt(two, s), `at ${s}`);
  // (And looked at out of order, as the course is drawn back and forth.)
  const later = battleAt(one, 90);
  battleAt(one, 30);
  assert.deepEqual(battleAt(one, 90), later);
});
