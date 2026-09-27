import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import type { CreatureBody } from "../../src/rules/index.ts";
import {
  BEAST_SCALE,
  MOST_OF_TONE,
  MOST_PARTS,
  beastsAt,
  birdsAt,
  buildBody,
  coatOf,
  defaultBody,
  doingOf,
  faunaOf,
  fishAt,
  posed,
  strideOf,
  type BeastNow,
  type BeastPart,
  type BirdNow,
  type FishNow,
} from "../../src/view/index.ts";

/** A body for the fixtures: a niche's plain one, with what differs. */
const shape = (niche: string, size: number, o: Partial<CreatureBody> = {}): CreatureBody => ({
  ...defaultBody(niche, size, false),
  ...o,
});
const FLIER: Partial<CreatureBody> = {
  legs: 2,
  wings: 2,
  covering: "feathers",
  moves: "fly",
  features: ["beak"],
  neck: 0.2,
};

const plan: VillagePlan = {
  ref: "town:0:7",
  name: "Herdwick",
  population: 120,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 5,
  homes: [{ x: 20, z: 0, yaw: 0, household: null }],
  fields: [
    { x: 160, z: 20, w: 40, d: 25, yaw: 0 },
    { x: 150, z: 70, w: 40, d: 25, yaw: 0.3 },
  ],
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: { x: 0, z: -700 },
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [],
  fauna: {
    wild: [
      {
        ref: "spec:0:3",
        name: "grey ox",
        niche: "grazer",
        size: 480,
        wool: false,
        stock: 0.9,
        body: shape("grazer", 480, { features: ["horns"] }),
      },
      {
        ref: "spec:0:5",
        name: "red deer",
        niche: "browser",
        size: 90,
        wool: false,
        stock: 0.8,
        body: shape("browser", 90, { features: ["antlers"] }),
      },
      {
        ref: "spec:0:9",
        name: "spotted bear",
        niche: "hunter",
        size: 280,
        wool: false,
        stock: 0.85,
        body: shape("hunter", 280),
      },
      {
        ref: "spec:0:66",
        name: "dun hare",
        niche: "seed-eater",
        size: 2.7,
        wool: false,
        stock: 0.7,
        body: shape("seed-eater", 2.7, { legs: 2, moves: "hop", eats: "seeds" }),
      },
      {
        ref: "spec:0:67",
        name: "spotted finch",
        niche: "seed-eater",
        size: 0.1,
        wool: false,
        stock: 0.8,
        body: shape("seed-eater", 0.1, { ...FLIER, eats: "seeds" }),
      },
      {
        ref: "spec:0:68",
        name: "dun weasel",
        niche: "small hunter",
        size: 9,
        wool: false,
        stock: 0.6,
        body: shape("small hunter", 9, { level: 3 }),
      },
      {
        ref: "spec:0:69",
        name: "spotted hyena",
        niche: "scavenger",
        size: 50,
        wool: false,
        stock: 0.5,
        body: shape("scavenger", 50, { eats: "carrion", level: 3 }),
      },
      {
        ref: "spec:0:70",
        name: "black vulture",
        niche: "scavenger",
        size: 8,
        wool: false,
        stock: 0.5,
        body: shape("scavenger", 8, { ...FLIER, eats: "carrion", level: 3 }),
      },
      {
        ref: "spec:0:71",
        name: "red pike",
        niche: "swimmer",
        size: 15,
        wool: false,
        stock: 0.6,
        body: shape("swimmer", 15, {
          legs: 0,
          fins: 2,
          covering: "scales",
          moves: "swim",
          eats: "plankton",
          tail: 0.8,
          neck: 0.2,
          warm: false,
        }),
      },
    ],
    flock: {
      ref: "spec:0:4",
      name: "pale woolly sheep",
      size: 60,
      wool: true,
      herders: 6,
      body: shape("grazer", 60, { covering: "wool", features: ["horns"] }),
    },
    raided: false,
  },
};

test("a lineage's name says what coat it wears", () => {
  assert.equal(coatOf("spotted bear", false).pattern, "spots");
  assert.equal(coatOf("brindled horse", false).pattern, "stripes");
  assert.equal(coatOf("grey ox", false).pattern, null);
  const hide = coatOf("red goat", false).coat,
    wool = coatOf("red woolly sheep", true).coat;
  assert.ok(wool[0] + wool[1] + wool[2] > hide[0] + hide[1] + hide[2], "wool is paler than hide");
});

/** Bodies of every make the plans can have, Earth's and other worlds'. */
const makes: CreatureBody[] = [
  shape("grazer", 400, { features: ["mane"] }),
  shape("grazer", 500, { covering: "wool", features: ["wide-horns", "hump"] }),
  shape("great beast", 5000),
  shape("browser", 200, { features: ["antlers"] }),
  shape("hunter", 200, { features: ["claws", "mane"] }),
  shape("seed-eater", 1, { legs: 2, moves: "hop" }),
  shape("seed-eater", 0.5, { ...FLIER, wings: 4, covering: "slick", features: ["crest"] }),
  shape("swimmer", 20, { legs: 0, fins: 4, covering: "scales", moves: "swim", tail: 0.8 }),
  shape("swimmer", 10, {
    symmetry: "radial",
    legs: 0,
    fins: 2,
    covering: "slick",
    moves: "swim",
  }),
  shape("grazer", 300, {
    segments: 2,
    legs: 8,
    covering: "plates",
    moves: "crawl",
    features: ["spines", "horns"],
  }),
  shape("small hunter", 20, {
    segments: 3,
    legs: 6,
    covering: "shell",
    moves: "crawl",
    features: ["claws", "crest", "spines"],
  }),
  shape("browser", 60, { legs: 0, covering: "scales", moves: "slither", tail: 0.1 }),
  shape("scavenger", 40, { legs: 2, moves: "walk", features: ["beak", "tusks", "trunk"] }),
];

test("a creature is built from its plan, finer at a finer setting, never past the most parts", () => {
  const parts: BeastPart[] = [];
  for (const [m, plan] of makes.entries()) {
    let last = 0;
    for (const detail of [0, 1, 2, 3]) {
      const b = buildBody(plan, detail, m % 2 ? "spots" : "stripes", m);
      for (const pose of [
        { gait: 0 as const, phase: 0, head: 0, crouch: 0 },
        { gait: 2 as const, phase: 1.3, head: 1, crouch: 1 },
      ]) {
        const n = posed(b, pose, parts);
        // (Never at the most, so nothing was left off.)
        assert.ok(n < MOST_PARTS, `make ${m} at detail ${detail}: ${n} parts`);
        for (const tone of [0, 1, 2] as const) {
          const of = parts.slice(0, n).filter((q) => q.tone === tone).length;
          assert.ok(
            of <= MOST_OF_TONE[tone],
            `make ${m} at detail ${detail}: ${of} of tone ${tone}`,
          );
        }
        for (let k = 0; k < n; k++) {
          const p = parts[k]!;
          for (const v of [p.x, p.y, p.z, p.sx, p.sy, p.sz, p.pitch, p.yaw])
            assert.ok(Number.isFinite(v), `make ${m}: part ${k} is somewhere`);
          assert.ok(p.sx > 0 && p.sy > 0 && p.sz > 0, `make ${m}: part ${k} has a size`);
        }
      }
      const n = posed(b, { gait: 0, phase: 0, head: 0, crouch: 0 }, parts);
      assert.ok(n >= last, `make ${m}: finer at detail ${detail} (${n} against ${last})`);
      last = n;
    }
  }
});

test("each body is its own shape: its legs, its wings beating, its fins, a slitherer waving", () => {
  const parts: BeastPart[] = [];
  const still = { gait: 0 as const, phase: 0, head: 0, crouch: 0 };
  // Legs are the parts that reach the ground; as many as the plan says.
  const feet = (plan: CreatureBody) => {
    const n = posed(buildBody(plan, 0), still, parts);
    return parts.slice(0, n).filter((p) => p.y - p.sy / 2 < 0.02 && p.sy > p.sx).length;
  };
  assert.equal(feet(makes[0]!), 4);
  assert.equal(feet(makes[9]!), 8);
  assert.equal(feet(makes[10]!), 6);
  assert.equal(feet(makes[5]!), 2);
  assert.equal(feet(makes[11]!), 0);
  // A flier's wings beat: the same wing high at one moment and low at another.
  const flier = buildBody(makes[6]!, 1),
    wingY = (phase: number) => {
      const n = posed(flier, { gait: 1, phase, head: 0, crouch: 0 }, parts);
      return parts
        .slice(0, n)
        .filter((p) => Math.abs(Math.abs(p.yaw) - Math.PI / 2) < 1e-9)
        .map((p) => p.y);
    };
  const up = wingY(0.5),
    down = wingY(1.6);
  assert.equal(up.length, 8, "a four-winged flier has four wings, each of two parts");
  assert.ok(Math.abs(up[0]! - down[0]!) > 0.05 * BEAST_SCALE, "its wings beat");
  // A slitherer's body waves from side to side as it goes.
  const snake = buildBody(makes[11]!, 1),
    xs = (phase: number) => {
      posed(snake, { gait: 1, phase, head: 0, crouch: 0 }, parts);
      return parts.slice(0, 4).map((p) => p.x);
    };
  assert.notDeepEqual(xs(0), xs(1.5));
  // A radial swimmer is a disc and its arms; nothing of a head.
  assert.equal(posed(buildBody(makes[8]!, 3), still, parts), 6);
  // A small body steps quicker than a great one.
  assert.ok(strideOf(buildBody(makes[5]!, 0)) > strideOf(buildBody(makes[2]!, 0)));
});

test("a grazer bows its head to its food, and an ox stands about as tall as a man", () => {
  const parts: BeastPart[] = [];
  const ox = buildBody(shape("grazer", 500, { features: ["horns"] }), 0),
    // (At the plainest detail: its body, four legs, its neck, then its head.)
    headOf = (head: number) => {
      posed(ox, { gait: 0, phase: 0, head, crouch: 0 }, parts);
      return parts[6]!;
    };
  const up = headOf(0).y,
    down = headOf(1).y;
  assert.ok(
    down < up * 0.6,
    `grazing, the head goes down (${down.toFixed(2)} against ${up.toFixed(2)})`,
  );
  // Drawn as much larger than life as a village's people: an ox about as tall as a man.
  posed(ox, { gait: 0, phase: 0, head: 0, crouch: 0 }, parts);
  const top = Math.max(...parts.slice(0, 7).map((p) => p.y + p.sy / 2));
  assert.ok(
    top > 1.2 * BEAST_SCALE && top < 2.8 * BEAST_SCALE,
    `an ox stands ${(top / BEAST_SCALE).toFixed(2)} m high`,
  );
  // A great beast towers over it, and a hare is small beside it.
  const height = (plan: CreatureBody) => {
    const n = posed(buildBody(plan, 0), { gait: 0, phase: 0, head: 0, crouch: 0 }, parts);
    return Math.max(...parts.slice(0, n).map((p) => p.y + p.sy / 2));
  };
  assert.ok(height(makes[2]!) > 1.5 * top);
  assert.ok(height(makes[5]!) < 0.5 * top);
});

test("the living world about a village keeps to the setting's count and lays out every level of its web", () => {
  for (const cap of [30, 80, 160, 320]) {
    const f = faunaOf(plan, cap, 2, true),
      beasts =
        f.herds.reduce((a, h) => a + h.members.length, 0) +
        f.packs.reduce((a, p) => a + p.members, 0);
    assert.ok(beasts <= cap + 4, `${beasts} beasts at ${cap}`);
    assert.ok(beasts >= Math.min(cap, 20) * 0.5, `${beasts} beasts at ${cap}: enough to see`);
    // The flocks graze in the pasture.
    const flock = f.herds.find((h) => f.species[h.species]!.flock)!;
    assert.ok(flock, "the village's flock");
    assert.ok(Math.hypot(flock.home.x - plan.pasture.x, flock.home.z - plan.pasture.z) < 1);
    // The wild herds keep off the fields' side, past the homes; the small game keeps to the
    // fields' edges, pecking at what the harvest leaves.
    for (const h of f.herds.filter((h) => !f.species[h.species]!.flock)) {
      if (f.species[h.species]!.niche === "seed-eater") {
        assert.ok(
          plan.fields.some((fl) => Math.hypot(h.home.x - fl.x, h.home.z - fl.z) < fl.w),
          "the small game at a field",
        );
        continue;
      }
      const r = Math.hypot(h.home.x, h.home.z);
      assert.ok(r > 100, `a herd ${r.toFixed(0)} m out`);
    }
    // Every band hunts at its level: the bear the herds, the weasel the small game; the
    // hyena trails a band of the hunters for what it leaves.
    assert.ok(f.packs.some((p) => f.species[p.species]!.niche === "hunter"));
    for (const [k, p] of f.packs.entries()) {
      const sp = f.species[p.species]!,
        game = f.species[f.herds[p.herd]!.species]!;
      if (sp.niche === "hunter") assert.ok(p.follows < 0 && game.niche !== "seed-eater");
      else if (sp.niche === "small hunter")
        assert.ok(p.follows < 0 && game.niche === "seed-eater", `the weasel hunts ${game.name}`);
      else {
        assert.equal(sp.niche, "scavenger");
        assert.ok(p.follows >= 0 && p.follows < k);
        assert.equal(f.species[f.packs[p.follows]!.species]!.niche, "hunter");
      }
    }
    // Every level is there to be seen, even at the plainest count.
    for (const niche of ["grazer", "browser", "hunter", "seed-eater", "small hunter", "scavenger"])
      assert.ok(
        f.species.some((sp) => sp.niche === niche),
        `a ${niche} about the village at ${cap}`,
      );
  }
  // Where the hunters raid the flocks, they hunt the flock.
  const raided = faunaOf({ ...plan, fauna: { ...plan.fauna!, raided: true } }, 160, 2, true);
  assert.ok(raided.species[raided.herds[raided.packs[0]!.herd]!.species]!.flock);
  // The plainest setting has no birds or fish; a village without water has no fish.
  const plain = faunaOf(plan, 30, 0, false);
  assert.equal(plain.birds.length + plain.fish.length, 0);
  assert.equal(faunaOf({ ...plan, water: null }, 160, 2, true).fish.length, 0);
  // Nothing lives about a village whose plan says nothing does.
  const none = faunaOf({ ...plan, fauna: undefined }, 160, 2, false);
  assert.equal(none.herds.length + none.packs.length, 0);
});

test("the beasts move smoothly by the screen's clock, and the same moment always looks the same", () => {
  const f = faunaOf(plan, 160, 2, true),
    a: BeastNow[] = [],
    b: BeastNow[] = [];
  const n = beastsAt(f, 123.4, a);
  assert.equal(beastsAt(f, 123.4, b), n);
  for (let i = 0; i < n; i++) {
    assert.equal(a[i]!.x, b[i]!.x);
    assert.equal(a[i]!.z, b[i]!.z);
  }
  // No beast ever stands in the water or in a home; a herd's beasts keep their room.
  const ground = f.ground;
  let close = 0,
    pairs = 0;
  for (let s = 0; s < 600; s += 4.3) {
    const m = beastsAt(f, s, a);
    for (let i = 0; i < m; i++) {
      const q = a[i]!,
        reach = f.species[q.species]!.reach;
      assert.ok(
        Math.hypot(q.x - ground.lake!.x, q.z - ground.lake!.z) >= ground.lake!.r + reach - 1e-6,
      );
      for (const h of ground.homes)
        assert.ok(Math.hypot(q.x - h.x, q.z - h.z) >= h.r + reach - 1e-6);
    }
    let from = 0;
    for (const h of f.herds) {
      const reach = f.species[h.species]!.reach;
      for (let i = from; i < from + h.members.length; i++)
        for (let j = i + 1; j < from + h.members.length; j++) {
          pairs++;
          if (Math.hypot(a[i]!.x - a[j]!.x, a[i]!.z - a[j]!.z) < reach) close++;
        }
      from += h.members.length;
    }
  }
  assert.ok(close / pairs < 0.01, `${close} of ${pairs} pairs stand in one another`);
  // Over a twentieth of a second no beast goes further than a sprint takes it.
  for (let s = 0; s < 400; s += 0.37) {
    const m = beastsAt(f, s, a);
    beastsAt(f, s + 0.05, b);
    for (let i = 0; i < m; i++) {
      const d = Math.hypot(b[i]!.x - a[i]!.x, b[i]!.z - a[i]!.z);
      assert.ok(d < 3, `beast ${i} at ${s.toFixed(2)} s moved ${d.toFixed(2)} m`);
    }
  }
});

test("a hunting band stalks its herd and runs at it; the herd lifts its heads, flees, and comes back", () => {
  const f = faunaOf(plan, 160, 2, true),
    pack = f.packs[0]!,
    herd = f.herds[pack.herd]!,
    out: BeastNow[] = [],
    // The hunters come after every herd's beasts; the band's first is the first after them.
    first = f.herds.reduce((a, h) => a + h.members.length, 0) + f.packs.slice(0, 0).length,
    herdStart = f.herds.slice(0, pack.herd).reduce((a, h) => a + h.members.length, 0),
    at = (phi: number) => {
      const s =
        (Math.floor(1000 / pack.period) + phi) * pack.period - pack.offset + 5 * pack.period;
      beastsAt(f, s, out);
      const hunter = out[first]!,
        beasts = out.slice(herdStart, herdStart + herd.members.length),
        mx = beasts.reduce((a, b) => a + b.x, 0) / beasts.length,
        mz = beasts.reduce((a, b) => a + b.z, 0) / beasts.length;
      return {
        hunter: { ...hunter, pose: { ...hunter.pose } },
        herd: { x: mx, z: mz, poses: beasts.map((b) => ({ ...b.pose })) },
        gap: Math.hypot(hunter.x - mx, hunter.z - mz),
      };
    };
  const prowl = at(0.3),
    stalk = at(0.65),
    chase = at(0.8),
    rest = at(0.95),
    back = at(0.45);
  assert.equal(stalk.hunter.pose.crouch, 1, "stalking, the hunter crouches");
  assert.ok(
    stalk.herd.poses.every((p) => p.head === 0),
    "the herd lifts its heads",
  );
  assert.equal(chase.hunter.pose.gait, 2, "the hunter runs");
  assert.ok(
    chase.herd.poses.every((p) => p.gait === 2),
    "the herd runs",
  );
  assert.ok(stalk.gap < prowl.gap, "stalking, the hunter closes");
  assert.ok(rest.gap > 40, `the herd got away (${rest.gap.toFixed(0)} m)`);
  assert.equal(doingOf(f.species[pack.species]!, stalk.hunter.pose), "stalking the herd");
  assert.equal(doingOf(f.species[herd.species]!, chase.herd.poses[0]!), "running from the hunters");
  // And by the next prowl the herd grazes again.
  assert.ok(
    back.herd.poses.some((p) => p.head === 1),
    "grazing again",
  );
});

test("a scavenger trails a band of hunters some way behind, and stirs no herd itself", () => {
  const f = faunaOf(plan, 160, 2, true),
    without = faunaOf(
      {
        ...plan,
        fauna: {
          ...plan.fauna!,
          wild: plan.fauna!.wild.filter((s) => s.name !== "spotted hyena"),
        },
      },
      160,
      2,
      true,
    ),
    k = f.packs.findIndex((p) => f.species[p.species]!.niche === "scavenger"),
    pack = f.packs[k]!,
    herdBeasts = f.herds.reduce((a, h) => a + h.members.length, 0),
    first = (j: number) => herdBeasts + f.packs.slice(0, j).reduce((a, p) => a + p.members, 0);
  assert.ok(k >= 0);
  assert.equal(
    herdBeasts,
    without.herds.reduce((a, h) => a + h.members.length, 0),
  );
  const a: BeastNow[] = [],
    b: BeastNow[] = [];
  let near = Infinity;
  const seen = new Set<string>();
  for (let s = 0; s < 900; s += 0.25) {
    beastsAt(f, s, a);
    beastsAt(without, s, b);
    // The herds go as they would without it.
    for (let i = 0; i < herdBeasts; i++) {
      assert.equal(a[i]!.x, b[i]!.x);
      assert.equal(a[i]!.z, b[i]!.z);
    }
    // Never on the hunters' heels: it waits off to the side, and feeds when they have gone.
    const it = a[first(k)]!,
      lead = a[first(pack.follows)]!,
      doing = doingOf(f.species[pack.species]!, it.pose);
    near = Math.min(near, Math.hypot(it.x - lead.x, it.z - lead.z));
    seen.add(doing);
    if (doing === "feeding where the hunters killed")
      assert.ok(Math.hypot(it.x - lead.x, it.z - lead.z) > 30, "the hunters have gone");
  }
  assert.deepEqual([...seen].sort(), [
    "feeding where the hunters killed",
    "trailing the hunters for what they leave",
    "watching the hunt from afar",
  ]);
  assert.ok(near > 15, `it keeps its distance (${near.toFixed(1)} m at the nearest)`);
});

test("the land's fliers wheel low over the fields and its scavengers high over the hunts; its swimmers leap from the water", () => {
  const f = faunaOf(plan, 160, 2, true),
    named = (name: string) => f.birds.filter((b) => f.species[b.species]!.name === name),
    finches = named("spotted finch"),
    vultures = named("black vulture");
  assert.ok(finches.length >= 2 && vultures.length >= 1);
  assert.ok(
    Math.min(...vultures.map((b) => b.high)) > Math.max(...finches.map((b) => b.high)),
    "the scavengers ride high",
  );
  assert.equal(
    doingOf(f.species[finches[0]!.species]!, { gait: 1, phase: 0, head: 0, crouch: 0 }),
    "wheeling over the fields",
  );
  assert.equal(
    doingOf(f.species[vultures[0]!.species]!, { gait: 1, phase: 0, head: 0, crouch: 0 }),
    "circling over the hunt",
  );
  const birds: BirdNow[] = [];
  assert.equal(birdsAt(f, 10, birds), f.birds.length);
  for (const b of birds.slice(0, f.birds.length)) assert.ok(b.y > 5, "in the air");
  // The swimmers are the land's own, leaping now and then.
  assert.ok(f.fish.length > 0 && f.fish.every((x) => f.species[x.species]!.niche === "swimmer"));
  const fish: FishNow[] = [];
  let leapt = 0;
  for (let s = 0; s < 60; s += 0.5) leapt += fishAt(f, s, fish);
  assert.ok(leapt > 0 && leapt < 6 * 120 * 0.5, `${leapt} leaps seen`);
  // A land with no fliers has no birds, and one with no swimmers no fish: they are its own.
  const bare = faunaOf(
    {
      ...plan,
      fauna: {
        ...plan.fauna!,
        wild: plan.fauna!.wild.filter((s) => s.body?.moves !== "fly" && s.niche !== "swimmer"),
      },
    },
    160,
    2,
    true,
  );
  assert.equal(bare.birds.length + bare.fish.length, 0);
});
