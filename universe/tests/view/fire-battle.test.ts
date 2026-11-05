// War past the line, W1b: a battle past the rifle is one that fire decides. Those who can answer stand off and
// fire, by bounds, and fall to what the other side looses; it ends when one side breaks and the victors come on
// over the ground; a host that cannot answer fire charges, and most fall before they arrive. It reads the hosts'
// orders (view/order.ts), not an arm's name; who wins, who falls and how many stay history's.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleOutcome, BattleSideNear } from "../../src/bridge/index.ts";
import {
  BATTLE_LENGTH,
  FIELD,
  MOMENTS,
  PLACED_SCALE,
  battleAt,
  blowWords,
  blowsAt,
  fieldMiddle,
  figureFate,
  fireOrder,
  hostOrder,
  menAt,
  newBattle,
  newBlows,
  orderFrom,
  rollNames,
  trooperWords,
  type BattleField,
} from "../../src/view/index.ts";
import { ARM_LOOKS } from "../../src/view/arms.ts";
import { deathWords } from "../../src/bridge/index.ts";

const side = (
  name: string,
  fielded: number,
  fallen: number,
  arm: string,
  mount = "",
  extra: Partial<BattleSideNear> = {},
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  wounded: Math.round(fallen * 0.8),
  host: { arm, guard: "helmet", mount },
  kit: arm,
  ...extra,
});
const near = (
  outcome: BattleOutcome,
  a: BattleSideNear,
  d: BattleSideNear,
  walls: 0 | 1 | 2 = 0,
): BattleNear => ({
  event: `ev:0:${outcome}${a.fielded}${a.host!.arm}${d.host!.arm}`,
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
  hills: false,
  river: false,
  walls,
  town: walls ? "Testholt" : null,
  figure: null,
  plan: {
    seed: "test battle",
    ages: [
      { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
    ] as never,
    lineages: [],
  },
});
const MODERN = near(
    "field",
    side("Ash", 6000, 1400, "automatic", "armoured", { cannon: true }),
    side("Elm", 5000, 1900, "autoloader", "", { cannon: true }),
  ),
  SPEARS = near("held", side("Ash", 6000, 3200, "spear"), side("Elm", 5000, 300, "autoloader")),
  /** Each host's forward edge among those still up at `s`. */
  edges = (f: BattleField, s: number) => {
    const now = battleAt(f, s),
      up = (k: 0 | 1) =>
        now.troopers.filter((t) => {
          const o = f.troopers[t.id]!;
          return t.side === k && (o.falls === null || o.falls > s) && (o.flees ?? 1e9) > s;
        });
    return [Math.max(...up(0).map((t) => t.x)), Math.min(...up(1).map((t) => t.x))] as const;
  };

test("fire reads numbers: two lines close, a stand-off stands, and none is a name", () => {
  const host = (arm: string) => ({ arm, mount: "" });
  assert.equal(fireOrder(host("rifle"), host("spear"), false), null, "lines close");
  assert.deepEqual(fireOrder(host("automatic"), host("autoloader"), false)?.stands, [true, true]);
  assert.deepEqual(fireOrder(host("spear"), host("automatic"), false)?.stands, [false, true]);
  assert.deepEqual(fireOrder(host("automatic"), host("spear"), false)?.stands, [true, false]);
  // (The lesser reach of the two is where it is fought: the other must come within it to answer.)
  assert.equal(
    fireOrder(host("automatic"), host("bow"), false)?.off,
    hostOrder(host("bow"), host("automatic")).standOff,
  );
  // (At walls: one who must raise ladders closes, and none stands off from walls with nothing to answer it.)
  assert.equal(fireOrder(host("repeater"), host("repeater"), true), null);
  assert.equal(fireOrder(host("autoloader"), host("spear"), true), null);
  assert.deepEqual(fireOrder(host("autoloader"), host("repeater"), true)?.stands, [true, true]);
  // (orderFrom's zero: under ten metres of reach a host has nothing to stand off with.)
  const hand = orderFrom({
    foe: { rate: 120, range: 900 },
    own: { rate: 20, range: 2 },
    command: 100,
  });
  assert.equal(hand.standOff, 0);
  assert.equal(hand.line, false);
});

test("every arm past the rifle, against every other: no one by the hand unless one side has nothing to answer with", () => {
  const armed = Object.keys(ARM_LOOKS);
  for (const a of armed)
    for (const d of armed) {
      const by = fireOrder({ arm: a, mount: "" }, { arm: d, mount: "" }, false);
      if (!by || !by.stands[0] || !by.stands[1]) continue;
      const f = newBattle(near("field", side("Ash", 900, 200, a), side("Elm", 800, 300, d)), 60),
        b = newBlows(f);
      assert.ok(
        !b.hits.some((h) => h.striker === "hand"),
        `${a} v ${d}: someone struck by the hand`,
      );
      assert.ok(!f.troopers.some((t) => t.by === "blow"), `${a} v ${d}: a death by a blow`);
    }
});

test("modern against modern: apart from first to last, by bounds, and history's falls", () => {
  for (const placed of [false, true]) {
    const f = newBattle(MODERN, placed ? 120 : 360, placed),
      fire = f.fire!;
    assert.deepEqual(fire.stands, [true, true]);
    assert.equal(fire.metres, placed ? fire.apart * PLACED_SCALE : fire.apart);
    assert.ok(fire.apart >= 30, `${fire.apart} m on the field`);
    for (let s = 0; s < 108; s += 3) {
      const [a, d] = edges(f, s),
        now = battleAt(f, s);
      assert.ok(d - a > fire.apart * 0.55, `at ${s}: only ${d - a} m apart`);
      assert.ok(!now.troopers.some((t) => t.act === "fight"), `by the hand at ${s}`);
    }
    // (Some down while others go, while they come on and as the fight goes on.)
    for (const s of [24, 70]) {
      const acts = battleAt(f, s).troopers.filter(
        (t) => t.side === 0 && (f.troopers[t.id]!.falls ?? 1e9) > s,
      );
      assert.ok(
        acts.some((t) => t.act === "prone"),
        `down at ${s}`,
      );
    }
    assert.ok(
      Array.from({ length: 60 }, (_, i) => 41 + i).some((s) =>
        battleAt(f, s).troopers.some((t) => t.side === 0 && t.act === "run"),
      ),
      "bounds as the fight goes on",
    );
    // (No wheel, no closing up: each keeps their squad's place.)
    assert.equal(f.wings, null);
    // (As many as history says.)
    assert.deepEqual(menAt(f, battleAt(f, BATTLE_LENGTH)).fallen, [1400, 1900]);
    // (The beaten fall back, and the victors come on over the ground to where they stood.)
    const after = edges(f, 128);
    assert.ok(
      after[0] > fire.line[1] - 8,
      `the victors at ${after[0]}, the beaten stood at ${fire.line[1]}`,
    );
    assert.ok(f.moments.some((m) => m.words.endsWith("come on over the ground")));
    assert.ok(f.moments.some((m) => m.words.includes("go to ground")));
    assert.ok(!f.moments.some((m) => /rush the line|lines meet|trench$/.test(m.words)));
    assert.equal(fieldMiddle(f), (fire.line[0] + fire.line[1]) / 2);
    // (Every figure stays on the field as it is drawn up.)
    for (const t of battleAt(f, 0).troopers) assert.ok(Math.abs(t.x) <= FIELD.x + 8, `${t.x}`);
  }
});

test("shots seen crossing the gap, shells landing, cars and guns standing off", () => {
  const f = newBattle(MODERN, 120, true),
    now = battleAt(f, 70);
  assert.ok(
    (now.bolts?.length ?? 0) > 0 || battleAt(f, 70.5).bolts?.length,
    "streaks of its rounds",
  );
  assert.ok(f.fire!.bursts.length > 0, "shells land");
  assert.ok(f.fire!.bursts.every((b) => Math.abs(b.z) <= FIELD.z && Math.abs(b.x) <= FIELD.x + 20));
  const cars = f.vehicles!,
    at = (s: number) => battleAt(f, s).vehicles!;
  assert.ok(cars.length > 0);
  const edge = edges(f, 70);
  for (const v of at(70))
    if (v.side === 0 && v.knocked === 0)
      assert.ok(v.x < edge[1] - 10, `a car stands off from the foe: ${v.x} against ${edge[1]}`);
  const guns = f.troopers.filter((t) => t.gun && t.side === 0 && (t.falls ?? 1e9) > 70);
  assert.ok(guns.length > 0);
  for (const g of guns) assert.equal(battleAt(f, 70).troopers[g.id]!.act, "prone");
  // (The guns fire until it is decided.)
  assert.ok(f.cannon.some((c) => c.fires.some((t) => t > MOMENTS.melee + 20)));
});

test("spears against guns come on apart and close, most fall on the way, those who arrive fight by the hand", () => {
  const f = newBattle(SPEARS, 360),
    fire = f.fire!;
  assert.deepEqual(fire.stands, [false, true]);
  assert.ok(f.hosts[0].open, "on foot, they come on apart");
  const dead = f.troopers.filter((t) => t.side === 0 && t.falls !== null),
    before = dead.filter((t) => t.falls! < MOMENTS.melee).length;
  assert.ok(before / dead.length > 0.5, `${before} of ${dead.length} before they arrive`);
  const fight = battleAt(f, MOMENTS.melee + 6).troopers.filter((t) => t.act === "fight");
  assert.ok(fight.some((t) => t.side === 0) && fight.some((t) => t.side === 1), "they fight there");
  const [a, d] = edges(f, MOMENTS.melee + 6);
  assert.ok(d - a < 6, `they arrived: ${d - a} m`);
  const b = newBlows(f),
    gunmen = b.hits.filter((h) => h.side === 1 && !h.back);
  assert.ok(
    gunmen.every((h) => h.striker === "hand"),
    "the gunmen fall only to those who got there",
  );
  assert.ok(
    gunmen.every((h) => h.at >= MOMENTS.melee),
    "and only once they have",
  );
  // (Those who defend with nothing to answer come out at those who fire on them.)
  const out = newBattle(
    near("field", side("Ash", 5000, 300, "autoloader"), side("Elm", 6000, 3200, "spear")),
    360,
  );
  assert.deepEqual(out.fire!.stands, [true, false]);
  assert.equal(out.ground.trench, undefined, "they dig no trench");
  assert.ok(
    battleAt(out, 44).troopers.some((t) => t.side === 1 && t.act === "run"),
    "they charge",
  );
  assert.ok(
    out.moments.some((m) => m.words.includes("nothing to answer with")),
    "and it is told",
  );
  // (A host of riders still rides at it.)
  assert.equal(
    newBattle(
      near(
        "held",
        side("Ash", 6000, 3200, "spear", "cavalry"),
        side("Elm", 5000, 300, "automatic"),
      ),
      120,
    ).hosts[0].mounted,
    "horse",
  );
});

test("one who fell to a bullet is told as that on his card, from how far, and his page says a shot", () => {
  const f = newBattle(MODERN, 120, true),
    b = newBlows(f),
    shot = f.troopers.find(
      (t) => t.by === "arrow" && t.side === 1 && b.hits[b.of[t.id]!]!.striker === "bullet",
    )!,
    words = blowWords(f, b, shot.id, BATTLE_LENGTH)!;
  assert.match(words, /fell, a (machine-gun )?bullet in .+, from \d+ m off/);
  assert.ok(!/press|bayonet|blow/.test(words), words);
  const metres = Number(/from (\d+) m off/.exec(words)![1]);
  assert.ok(metres >= 50, `from ${metres} m off`);
  // (Shot down as they fell back: no one cut them down.)
  const running = f.troopers.find((t) => t.by === "rout")!;
  assert.match(blowWords(f, b, running.id, BATTLE_LENGTH)!, /shot down as they fell back, a/);
  const close = newBattle(MODERN, 120),
    closeRunning = close.troopers.find((t) => t.by === "rout")!;
  assert.ok(!/cut down/.test(trooperWords(close, closeRunning.id, BATTLE_LENGTH)));
  // (His fate is the roll's as it was: fell is fell.)
  assert.equal(figureFate(f, b, shot.id), "fell");
  const names = rollNames(f, b, {
    attacker: { fell: [], hurt: [], stood: [], towns: [] },
    defender: { fell: [], hurt: [], stood: [], towns: [] },
  } as never);
  assert.equal(names.length, f.troopers.length);
  const page = (blow: "shot" | "edge" | "fire") =>
    deathWords(
      {
        event: "ev",
        from: "battle",
        year: 371,
        where: "the battle at Pounholt",
        blow,
        arm: blow === "shot" ? "a steel rifle" : blow === "edge" ? "a bronze axe" : "a beam",
        member: "head",
        words: "~ head",
        at: 0,
      },
      1,
    );
  assert.match(
    page("shot"),
    /^killed by a shot to .+ head at the battle at Pounholt in 371, from a steel rifle$/,
  );
  assert.match(page("edge"), /^killed by a blow to .+ head/);
  assert.match(page("fire"), /^killed by a burn to .+ head/);
});

test("the wounded who live were struck from afar too, and go back; the same second is the same every time", () => {
  const f = newBattle(MODERN, 120, true),
    b = newBlows(f),
    living = b.hits.filter((h) => h.back);
  assert.ok(living.length > 0);
  assert.ok(living.every((h) => h.striker !== "hand"));
  const now = blowsAt(f, b, battleAt(f, 70), "full");
  assert.deepEqual(now, blowsAt(f, b, battleAt(f, 70), "full"));
  assert.deepEqual(battleAt(newBattle(MODERN, 120, true), 70), battleAt(f, 70));
});

test("on a battle's recorded course: its break, its falls and their seconds as history has them, and none by the hand", () => {
  const frame = (at: number, a: number, d: number) => ({
      at,
      dead: [a, d] as [number, number],
      morale: [0.8, 0.5] as [number, number],
      pressure: 0.2,
    }),
    n: BattleNear = {
      ...MODERN,
      combat: {
        model: 2,
        broken: 1,
        reason: "morale",
        rout: 72,
        power: [1, 1],
        frames: [
          frame(16, 0, 0),
          frame(40, 200, 300),
          frame(60, 700, 900),
          frame(72, 1400, 1300),
          frame(84, 1400, 1900),
        ],
      },
    },
    f = newBattle(n, 120, true),
    b = newBlows(f);
  assert.deepEqual(f.fire!.stands, [true, true]);
  assert.ok(!f.troopers.some((t) => t.by === "blow"), "a death by a blow");
  assert.ok(!b.hits.some((h) => h.striker === "hand"), "someone struck by the hand");
  assert.deepEqual(menAt(f, battleAt(f, BATTLE_LENGTH)).fallen, [1400, 1900]);
  assert.ok(f.moments.some((m) => m.at === 72 && m.words.includes("fall back under fire")));
  for (let s = 0; s < 72; s += 3) {
    const [a, d] = edges(f, s);
    assert.ok(d - a > f.fire!.apart * 0.55, `at ${s}: only ${d - a} m apart`);
  }
  // (They fall when the record has them fall.)
  const fallenBy = (s: number) => f.troopers.filter((t) => t.falls !== null && t.falls <= s).length;
  assert.ok(fallenBy(60) > fallenBy(40) && fallenBy(84) > fallenBy(72));
  // (A record of spears that broke before they arrived: no one of the guns falls to them.)
  const broke = newBattle(
    {
      ...SPEARS,
      defender: { ...SPEARS.defender, fallen: 0, wounded: 0 },
      combat: {
        model: 2,
        broken: 0,
        reason: "morale",
        rout: 34,
        power: [1, 1],
        frames: [frame(16, 0, 0), frame(30, 2000, 0), frame(34, 2600, 0), frame(46, 3200, 0)],
      },
    },
    120,
    true,
  );
  assert.equal(broke.troopers.filter((t) => t.side === 1 && t.falls !== null).length, 0);
  assert.ok(!broke.troopers.some((t) => t.by === "blow"), "they never got there");
  assert.ok(!battleAt(broke, 60).troopers.some((t) => t.act === "fight"), "no one fights");
});
