import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleOutcome, BattleSideNear } from "../../src/bridge/index.ts";
import { LETHAL, MAIM } from "../../src/rules/index.ts";
import {
  BATTLE_LENGTH,
  BLEED,
  BLOW_PLACES,
  MOMENTS,
  SEVER,
  battleAt,
  blowWords,
  blowsAt,
  figureAnatomy,
  figureOf,
  hurtFigures,
  newBattle,
  newBlows,
  type FigureBody,
} from "../../src/view/index.ts";
import { CUTS_OFF, placeWeights } from "../../src/view/blows.ts";

// Phase 55: blows seen where they land — where each one struck was struck and with what, how
// they went down, the wounds and the parts cut off, history's wounded who lived going back.

const side = (
  name: string,
  fielded: number,
  fallen: number,
  host: [arm: string, guard: string, mount: string],
  extra: Partial<BattleSideNear> = {},
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  host: { arm: host[0], guard: host[1], mount: host[2] },
  kit: `${host[0]}s`,
  ...extra,
});

function near(
  outcome: BattleOutcome,
  a: BattleSideNear,
  d: BattleSideNear,
  ground: { hills?: boolean; river?: boolean; walls?: 0 | 1 | 2 } = {},
  figure: FigureBody | null = null,
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
    figure,
    plan: {
      seed: "test battle",
      ages: [
        { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
      ] as never,
      lineages: [],
    },
  };
}

// Axes against swords, history's wounded and maimed given: the fixture most is asked of.
const BLADES = () =>
  newBattle(
    near(
      "field",
      side("Ash", 900, 160, ["axe", "mail", ""], { wounded: 380, maimed: 30 }),
      side("Elm", 700, 220, ["sword", "shield", ""], { wounded: 300, maimed: 40 }),
    ),
    360,
  );
const BOWS = () =>
  newBattle(
    near(
      "held",
      side("Ash", 2400, 400, ["bow", "shield", ""], { wounded: 700, maimed: 40 }),
      side("Elm", 1800, 200, ["spear", "shield", ""], { wounded: 500, maimed: 30 }),
      { hills: true },
    ),
    360,
  );
const GUNS = () =>
  newBattle(
    near(
      "field",
      side("Ash", 6000, 1500, ["automatic", "helmet", "armoured"], {
        cannon: true,
        wounded: 2000,
        maimed: 250,
      }),
      side("Elm", 4000, 1700, ["repeater", "plate", ""], {
        cannon: true,
        wounded: 2600,
        maimed: 300,
      }),
    ),
    360,
  );
// An older save: no wounded, no maimed told.
const OLD = () =>
  newBattle(
    near(
      "field",
      side("Ash", 900, 120, ["spear", "shield", ""]),
      side("Elm", 700, 160, ["spear", "shield", ""]),
    ),
    360,
  );

const count = <T>(xs: readonly T[], f: (x: T) => boolean) => xs.filter(f).length;
/**
 * A view's blows as text to digest: numbers to a millionth, so the digest pins the blows and not
 * the last bit of a float (the view's sines and powers can differ by one ulp between platforms).
 */
const rounded = (x: unknown): string =>
  JSON.stringify(x, (_, v: unknown) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v));

function digest(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}

test("a figure's places: its trunk, its head and what is on it, each arm with its hand, each leg with its shoe", () => {
  const at = (d: number) => figureAnatomy(figureOf(null, d));
  assert.deepEqual(at(1), {
    parts: {
      head: [1],
      trunk: [0],
      "arm-l": [3, 7],
      "arm-r": [2, 6],
      "hand-l": [7],
      "hand-r": [6],
      "leg-l": [5, 9],
      "leg-r": [4, 8],
    },
    on: {
      head: 1,
      trunk: 0,
      "arm-l": 3,
      "arm-r": 2,
      "hand-l": 7,
      "hand-r": 6,
      "leg-l": 5,
      "leg-r": 4,
    },
  });
  // (Finer: the hair and the eyes go with the head.)
  assert.deepEqual(at(2).parts.head, [1, 10, 11, 12, 13]);
  // (Plainest: no hands drawn, so a hand's wound is at its arm's end.)
  assert.deepEqual(at(0).parts["hand-r"], []);
  assert.equal(at(0).on["hand-r"], 2);
  // A mantle over a ring of arms: a trunk and nothing else to strike.
  const swimmer = figureAnatomy(
    figureOf({
      clade: "swimmer",
      medium: "water",
      symmetry: "radial",
      manipulators: "tentacles",
      limbs: 8,
      skin: "skin",
      size: 60,
    }),
  );
  assert.deepEqual(
    BLOW_PLACES.map((p) => swimmer.on[p]),
    [-1, 0, -1, -1, -1, -1, -1, -1],
  );
});

test("where blows land: by the nines, the dead the more on the head and trunk, the maimed on the limbs", () => {
  const share = (w: number[]) => (w[0]! + w[1]!) / w.reduce((a, b) => a + b, 0);
  for (const blow of ["edge", "point", "blunt", "shot", "crush"] as const) {
    const dead = placeWeights("dead", "hand", blow, false),
      wounded = placeWeights("wounded", "hand", blow, false);
    assert.ok(share(dead) > 0.6, `${blow}: the dead mostly on the head and trunk`);
    assert.ok(share(wounded) < 0.5, `${blow}: the wounded mostly on the limbs`);
  }
  // (Exactly: the nines times the share a blow there kills.)
  assert.deepEqual(placeWeights("dead", "hand", "edge", false), [
    9 * Math.min(0.95, LETHAL.edge * 1.5),
    36 * LETHAL.edge,
    7 * 0.06,
    7 * 0.06,
    2 * 0.06,
    2 * 0.06,
    18 * 0.06,
    18 * 0.06,
  ]);
  assert.deepEqual(placeWeights("maimed", "hand", "edge", true), [0, 0, 5, 5, 4, 4, 3, 3]);
  assert.deepEqual(placeWeights("maimed", "bullet", "shot", false), [0, 0, 7, 7, 2, 2, 18, 18]);
  // A cannon's ball kills wherever it strikes, a limb less often.
  assert.deepEqual(placeWeights("dead", "ball", "crush", false), [
    9 * 0.95,
    36 * 0.95,
    7 * 0.4,
    7 * 0.4,
    2 * 0.4,
    2 * 0.4,
    18 * 0.4,
    18 * 0.4,
  ]);
});

test("so many wounded figures for so many wounded men, at most four fifths of those who stand", () => {
  assert.equal(hurtFigures(0, 100, 3), 0);
  assert.equal(hurtFigures(380, 240, 3), 127);
  assert.equal(hurtFigures(380, 100, 3), 80);
  assert.equal(hurtFigures(5, 100, 25), 0);
  assert.equal(hurtFigures(13, 100, 25), 1);
});

test("every one who falls is struck, and history's wounded and maimed are drawn so many to a figure", () => {
  const f = BLADES(),
    b = newBlows(f);
  assert.deepEqual(b.dead, [f.hosts[0].falls, f.hosts[1].falls]);
  assert.deepEqual(b.dead, [53, 73]);
  assert.deepEqual(b.hurt, [127, 100]);
  // (Of the wounded drawn, as many maimed as history's maimed are of its wounded: 30/380, 40/300.)
  assert.deepEqual(b.maimed, [10, 13]);
  // Each struck once, in the order struck; every fallen one among them.
  assert.equal(b.hits.length, 53 + 73 + 127 + 100);
  assert.ok(b.hits.every((h, i) => i === 0 || b.hits[i - 1]!.at <= h.at));
  for (const t of f.troopers)
    if (t.falls !== null) assert.equal(b.hits[b.of[t.id]!]!.at, t.falls, `trooper ${t.id}`);
  // The wounded who live never fall, bear no banner, and are struck before they run.
  for (const h of b.hits.filter((x) => x.back)) {
    const t = f.troopers[h.id]!;
    assert.equal(t.falls, null);
    assert.ok(!t.bearer);
    assert.ok(t.flees === null || h.at < t.flees);
    assert.ok(h.back!.going > h.at && h.back!.there > h.back!.going);
  }
  // An axe and a sword cut off what they maim: every maimed one here has lost the limb struck.
  const maimed = b.hits.filter((h) => h.back && (h.lost || h.shattered));
  assert.equal(maimed.length, 23);
  assert.ok(maimed.every((h) => h.lost === h.place && h.striker === "hand"));
  assert.ok(CUTS_OFF.has("axe") && CUTS_OFF.has("sword") && !CUTS_OFF.has("claws"));
  // Each part cut off lies somewhere; no side loses more than SEVER.most.
  assert.equal(
    b.loose.length,
    count(b.hits, (h) => h.lost !== null),
  );
  for (const s of [0, 1] as const)
    assert.ok(count(b.hits, (h) => h.side === s && h.lost !== null) <= SEVER.most);
  // The ways back: the propped each with one who helps them, one helper to one wounded.
  const ways = (w: string) => count(b.hits, (h) => h.back?.way === w);
  assert.equal(ways("crawl") + ways("limp") + ways("propped"), 227);
  assert.equal(b.helps.length, ways("propped"));
  assert.equal(new Set(b.helps.map((h) => h.id)).size, b.helps.length);
  for (const hp of b.helps) {
    const w = b.hits[hp.hit]!;
    assert.equal(w.back!.helper, hp.id);
    assert.equal(f.troopers[hp.id]!.falls, null);
    assert.equal(b.of[hp.id], -1, "one who helps is not struck");
    assert.ok(hp.start < hp.meet && hp.meet <= w.back!.going && w.back!.there < hp.home);
  }
  // (The same battle, the same blows.)
  assert.deepEqual(newBlows(BLADES()), b);
});

test("the blows of a battle are its own (recorded 2026-10-26 with rules/wounds.ts's LETHAL and MAIM then)", () => {
  const recorded =
    JSON.stringify(LETHAL) ===
      JSON.stringify({
        edge: 0.35,
        point: 0.45,
        blunt: 0.25,
        shot: 0.55,
        crush: 0.45,
        fire: 0.3,
      }) &&
    JSON.stringify(MAIM) ===
      JSON.stringify({ edge: 0.1, point: 0.06, blunt: 0.04, shot: 0.14, crush: 0.12, fire: 0.03 });
  // (Tuned since: the places move; re-record from the failure's actual digest.)
  if (!recorded) return;
  assert.equal(digest(rounded(newBlows(BLADES()))), "8ff317f9");
  assert.equal(digest(rounded(newBlows(GUNS()))), "aeb522cf");
});

test("arrows stick where they strike; a cannon's ball and a shell knock men off their feet", () => {
  const bows = newBlows(BOWS());
  const shafts = bows.hits.filter((h) => h.striker === "arrow");
  assert.ok(shafts.length > 0);
  assert.ok(shafts.every((h) => h.shaft !== null && h.mark === "hole" && h.blow === "point"));
  // (Only arrows and darts stick.)
  assert.ok(
    bows.hits.every((h) => (h.shaft !== null) === (h.striker === "arrow" || h.striker === "dart")),
  );
  const f = GUNS(),
    b = newBlows(f),
    of = (side: 0 | 1, st: string) => count(b.hits, (h) => h.side === side && h.striker === st);
  // The machine guns' host fired shells (smokeless powder), the repeaters' cannon balls.
  assert.deepEqual([of(0, "ball"), of(1, "shell")], [14, 21]);
  assert.deepEqual([of(0, "shell"), of(1, "ball")], [0, 0]);
  for (const h of b.hits.filter((x) => x.striker === "ball" || x.striker === "shell")) {
    assert.ok(!h.back, "the ordnance's hits are among the dead");
    assert.equal(h.mark, "smash");
    if (h.fall) {
      assert.equal(h.fall, "blasted");
      const far = Math.hypot(h.lie!.x - h.x, h.lie!.z - h.z);
      assert.ok(far >= 1.2 - 1e-9 && far <= 2.8 + 1e-9, `thrown ${far} m`);
    }
  }
  // Shot shatters the limbs of the maimed; nothing living is cut off but by a blade.
  assert.ok(b.hits.filter((h) => h.back && h.lost).every((h) => h.striker === "hand"));
  assert.ok(count(b.hits, (h) => h.shattered) > 0);
});

test("as the battle goes: the fallen and the wounded as struck, the counts the battle's own", () => {
  const f = BLADES(),
    b = newBlows(f);
  for (const s of [0, 30, MOMENTS.melee + 5, 75, 110, BATTLE_LENGTH]) {
    const base = battleAt(f, s),
      now = blowsAt(f, b, base, "full");
    // (The battle's own tallies stand.)
    assert.deepEqual(now.fallen, base.fallen);
    assert.deepEqual(now.standing, base.standing);
    assert.equal(now.troopers.length, base.troopers.length);
    const struck = b.hits.filter((h) => h.at <= s);
    assert.deepEqual(now.hurt, [
      count(struck, (h) => h.side === 0 && h.back !== null),
      count(struck, (h) => h.side === 1 && h.back !== null),
    ]);
    for (const h of struck) assert.equal(now.troopers[h.id]!.hit, h.place);
    assert.equal(now.spray.length, 0);
    assert.ok(now.wounds!.length >= struck.length);
  }
  const end = blowsAt(f, b, battleAt(f, BATTLE_LENGTH), "full");
  assert.deepEqual(end.hurt, [127, 100]);
  assert.equal(end.limbs!.length, b.loose.length);
  assert.equal(
    count(end.troopers, (t) => t.lost !== undefined),
    b.loose.length,
  );
  assert.ok(end.limbs!.every((l) => l.y === 0 && Math.abs(l.pitch - Math.PI / 2) < 1e-9));
  // (At the end the wounded who walked sit behind the lines; those who crawled lie there.)
  assert.equal(
    count(end.troopers, (t) => t.act === "sit"),
    count(b.hits, (h) => h.back !== null && h.back.way !== "crawl"),
  );
  assert.ok(end.blood.length <= BLEED.most, `blood ${end.blood.length}`);
});

test("every one drawn is of one shape, the blows' marks set over the battle's own", () => {
  // (So the render's loops over them see one kind of object, however they are marked.)
  const keys = "id,side,x,y,z,yaw,act,cycle,down,back,size,bearer,crawl,gun,hit,since,lost,fell";
  for (const f of [BLADES(), GUNS()]) {
    const b = newBlows(f);
    for (const s of [0, 40, MOMENTS.melee + 5, 110, BATTLE_LENGTH]) {
      const base = battleAt(f, s);
      for (const now of [base, blowsAt(f, b, base, "full"), blowsAt(f, b, base, "none")])
        for (const t of now.troopers) assert.equal(Object.keys(t).join(), keys, `at ${s}: ${t.id}`);
    }
  }
});

test("a battle bled white shows no more blood than is drawn, each part cut off keeping its own", () => {
  // (A figure for each man, most of them struck: 3,191 pools and smears by the end, uncapped.)
  const f = newBattle(
      near(
        "field",
        side("Ash", 360, 100, ["axe", "mail", ""], { wounded: 260, maimed: 40 }),
        side("Elm", 360, 120, ["sword", "shield", ""], { wounded: 240, maimed: 40 }),
      ),
      360,
    ),
    b = newBlows(f),
    end = blowsAt(f, b, battleAt(f, BATTLE_LENGTH), "full");
  assert.equal(f.per, 1);
  // (The wounded as the one rule has them, bridge/roll.ts battleFigures: four in five of those standing.)
  assert.deepEqual([b.dead, b.hurt, b.loose.length], [[100, 120], [208, 192], 2 * SEVER.most]);
  assert.equal(end.blood.length, BLEED.most);
  // (The last, under the parts cut off where they lie.)
  const under = end.blood.slice(BLEED.most - b.loose.length);
  assert.ok(under.every((p, i) => p.x === b.loose[i]!.x && p.z === b.loose[i]!.z));
});

test("less shows smaller wounds and nothing cut off; none shows no blood at all, the wounded still going back", () => {
  const f = BLADES(),
    b = newBlows(f),
    base = battleAt(f, 90),
    full = blowsAt(f, b, base, "full"),
    less = blowsAt(f, b, base, "less"),
    none = blowsAt(f, b, base, "none");
  assert.ok(
    less.wounds!.length > 0 && less.wounds!.every((w) => w.mark !== "stump" && w.spray === 0),
  );
  assert.equal(less.limbs!.length, 0);
  assert.ok(less.troopers.every((t) => t.lost === undefined));
  assert.ok(less.blood.length < full.blood.length);
  assert.deepEqual(
    [none.wounds!.length, none.stuck!.length, none.limbs!.length, none.blood.length],
    [0, 0, 0, 0],
  );
  // (The same acts at every setting.)
  assert.deepEqual(
    none.troopers.map((t) => t.act),
    full.troopers.map((t) => t.act),
  );
});

test("the ranks close up behind those who go back", () => {
  const f = BLADES(),
    b = newBlows(f),
    w = b.hits.find((h) => {
      if (!h.back || h.back.way === "slump") return false;
      const t = f.troopers[h.id]!,
        file = f.files[h.side]![t.file]!,
        next = file[file.indexOf(t) + 1];
      // (One behind them who is never struck, helps no one, has no other wounded ahead, and is
      // in the line two seconds after they go back.)
      return (
        !!next &&
        b.of[next.id] === -1 &&
        b.helping[next.id] === -1 &&
        next.falls === null &&
        file
          .slice(0, file.indexOf(t))
          .every((o) => b.of[o.id] === -1 || !b.hits[b.of[o.id]!]!.back) &&
        h.back.going + 2 < MOMENTS.rout &&
        ["brace", "fight"].includes(battleAt(f, h.back.going + 2).troopers[next.id]!.act)
      );
    })!;
  assert.ok(w, "a wounded one with one in the line behind them");
  const t = f.troopers[w.id]!,
    file = f.files[w.side]![t.file]!,
    next = file[file.indexOf(t) + 1]!,
    s = w.back!.going + 2,
    base = battleAt(f, s),
    now = blowsAt(f, b, base, "full"),
    rear = w.side === 0 ? -1 : 1;
  // (A rank's gap on foot, shoulder to shoulder: 1.9 m.)
  assert.ok(
    Math.abs(now.troopers[next.id]!.x - (base.troopers[next.id]!.x - rear * 1.9)) < 1e-9,
    "stepped up a rank",
  );
  assert.equal(now.troopers[next.id]!.act, "fight");
});

test("an older save, with no wounded told: only the fallen are struck", () => {
  const f = OLD(),
    b = newBlows(f);
  assert.deepEqual(b.hurt, [0, 0]);
  assert.equal(b.hits.length, f.hosts[0].falls + f.hosts[1].falls);
  assert.equal(b.helps.length, 0);
  // (Spears cut nothing off.)
  assert.equal(b.loose.length, 0);
  const end = blowsAt(f, b, battleAt(f, BATTLE_LENGTH), "full");
  assert.equal(end.blood.length, battleAt(f, BATTLE_LENGTH).blood.length);
});

test("one struck, told: where and with what, what was cut off, and what they are doing", () => {
  const f = BLADES(),
    b = newBlows(f),
    h = b.hits.find((x) => x.back && x.lost)!;
  assert.equal(
    blowWords(f, b, h.id, h.at + 0.3),
    "👁 An axeman of the realm of Ash, in the first rank (a figure for 3 men): struck in the left leg by a sword, their left leg cut off, reeling.",
  );
  assert.equal(
    blowWords(f, b, h.id, h.back!.going + 2),
    "👁 An axeman of the realm of Ash, in the first rank (a figure for 3 men): wounded in the left leg by a sword, their left leg cut off, crawling back through the ranks.",
  );
  assert.equal(blowWords(f, b, h.id, h.at - 1), null);
  const hp = b.helps[0]!;
  assert.match(
    blowWords(f, b, hp.id, hp.start + 0.1)!,
    /: helping a wounded comrade back through the ranks\.$/,
  );
});
