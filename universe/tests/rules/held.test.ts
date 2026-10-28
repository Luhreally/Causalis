// Phase 61: the god's hand in a soldier and in a beast, the rules' part — the fight about a soldier
// taken on the field (rules/fight.ts) and the small world about a beast (rules/wild.ts), each
// stepped by the hand's bids on keyed draws; the blows track's rule they deal their blows by
// (rules/blows.ts, moved from the view); a people's body as the hand moves it (rules/possess.ts
// personFrame).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLOW_PLACES,
  FIGHT_ACT,
  FIGHT_DRAWS,
  FIGHT_HIT,
  FIGHT_HURT,
  FIGHT_LEANS,
  FIGHT_PACE,
  FIGHT_TILT,
  FIGHT_TOLD,
  FIGHT_WARD,
  HAND_ACT,
  POSSESS_HZ,
  WILD_ACT,
  WILD_BOUNDS,
  WILD_STRAY,
  WILD_TOLD,
  anatomyOf,
  blowPlaceOf,
  copyFight,
  fightBody,
  fightDecided,
  fightLeaning,
  fightMights,
  fightOffers,
  fightOut,
  fightWorld,
  herdMiddle,
  landsOn,
  personFrame,
  placeWeights,
  stepFight,
  stepWild,
  strayed,
  unpackWild,
  wildFrame,
  wildOffers,
  wildWorld,
  MEMBERS,
  type BodyPlan,
  type CreatureBody,
  type FightScene,
  type FightSide,
  type FightWorld,
  type HandBid,
  type LocalDraw,
  type WildScene,
} from "../../src/rules/index.ts";

/** A keyed draw standing in for the world's (the sim's are `world.rng.real`'s). */
const drawOf =
  (k: number): LocalDraw =>
  (subject, step, purpose, n = 0) => {
    let h =
      (Math.imul(subject ^ 0x9e3779b9, 0x85ebca6b) ^
        Math.imul(step + 0x632be5ab, 0xc2b2ae35) ^
        Math.imul(purpose * 31 + n + k * 7919, 0x27d4eb2f)) >>>
      0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
const still: HandBid = { mx: 0, mz: 0, run: false, act: 0 },
  strike: HandBid = { mx: 0, mz: 0, run: false, act: HAND_ACT.strike };

const side = (might: number, figures: number, looses: FightSide["looses"] = "none"): FightSide => ({
  blow: "point",
  cuts: false,
  looses,
  reload: looses === "none" ? 0 : 4,
  guard: 0.3,
  shock: 0.5,
  might,
  mounted: false,
  figures,
  before: 0,
});
const sceneOf = (mights: [number, number], n: [number, number], looses = false): FightScene => ({
  sides: [side(mights[0], n[0], looses ? "arrows" : "none"), side(mights[1], n[1])],
  from: 20,
  length: 150,
  meet: 0,
  flanks: true,
});
/** He (a defender, side 1) at the middle; a foe `far` metres before him; the rest in two lines. */
function field(far: number, each = 0): FightWorld {
  const bodies = [
    fightBody(0, 1, { x: 0, z: 0, yaw: -Math.PI / 2 }, 1, false),
    fightBody(1, 0, { x: -far, z: 0, yaw: Math.PI / 2 }, 1, false),
  ];
  for (let i = 0; i < each; i++) {
    bodies.push(
      fightBody(2 + 2 * i, 0, { x: -8, z: (i - each / 2) * 1.4, yaw: Math.PI / 2 }, 1, false),
    );
    bodies.push(
      fightBody(3 + 2 * i, 1, { x: 8, z: (i - each / 2) * 1.4, yaw: -Math.PI / 2 }, 1, false),
    );
  }
  return fightWorld(bodies);
}
const toldOf = (f: FightWorld) => FIGHT_TOLD[f.told[0]];

test("the fight leans history's way: its victor the mightier by FIGHT_TILT, the more where it was outnumbered", () => {
  const [a, d] = fightMights(1, [100, 100]);
  assert.ok(Math.abs(d - FIGHT_TILT) < 1e-12 && Math.abs(a - 1 / FIGHT_TILT) < 1e-12, `${a} ${d}`);
  const [a4, d4] = fightMights(1, [400, 100]);
  assert.ok(d4 > d && a4 < a, "the victor outnumbered four to one, the mightier for it");
  assert.deepEqual(fightMights(0, [1, 10_000]), [4, 0.25], "never past four, nor under a quarter");
});

test("where the fight left alone breaks history's victor, the day is leant the more: FIGHT_TILT over again, FIGHT_LEANS times at most", () => {
  const n: [number, number] = [5, 5],
    tilts: number[] = [],
    sceneAt = (tilt: number) => {
      tilts.push(tilt);
      return sceneOf(fightMights(0, n, tilt), n);
    };
  // History's victors the attackers: left alone at FIGHT_TILT they break; leant once more, the defenders.
  const once = copyFight(field(1.5, 4));
  fightOut(sceneOf(fightMights(0, n), n), once, drawOf(9), 3000);
  assert.equal(once.broke, 0);
  const leant = fightLeaning(sceneAt, field(1.5, 4), 0, drawOf(9));
  assert.equal(leant.idle.broke, 1, "left alone, it goes history's way");
  assert.deepEqual(tilts, [FIGHT_TILT, FIGHT_TILT * FIGHT_TILT]);
  assert.deepEqual(
    leant.scene.sides.map((s) => s.might),
    fightMights(0, n, FIGHT_TILT * FIGHT_TILT),
  );
  // Where it goes history's way at FIGHT_TILT, laid once.
  tilts.length = 0;
  const plain = fightLeaning(sceneAt, field(1.5, 4), 0, drawOf(0));
  assert.notEqual(plain.idle.broke, 0);
  assert.deepEqual(tilts, [FIGHT_TILT]);
  // Never more than FIGHT_LEANS times, though it goes against history still.
  let laid = 0;
  const stubborn = fightLeaning(
    () => (laid++, sceneOf(fightMights(0, n), n)),
    field(1.5, 4),
    0,
    drawOf(9),
  );
  assert.equal(laid, FIGHT_LEANS);
  assert.equal(stubborn.idle.broke, 0);
});

test("a fight is the same fought twice by the same draws, and a copy stepped ahead leaves the kept one be", () => {
  const scene = sceneOf([1, 1], [41, 41]),
    a = field(6, 40),
    b = copyFight(a),
    kept = JSON.stringify(a);
  const n = fightOut(scene, a, drawOf(3), 3000),
    m = fightOut(scene, b, drawOf(3), 3000);
  assert.equal(n, m);
  assert.deepEqual(a, b);
  assert.ok(a.deeds.length > 0, "blows struck down some");
  assert.ok(fightDecided(a).beaten >= 0, "a side broke");
  // (A copy is its own: stepping it touches nothing of what it was copied from.)
  const fresh = field(6, 40),
    ahead = copyFight(fresh);
  for (let i = 0; i < 40; i++) stepFight(scene, ahead, strike, drawOf(3));
  assert.equal(JSON.stringify(fresh), kept);
  // Another draw, another day.
  const c = field(6, 40);
  fightOut(scene, c, drawOf(4), 3000);
  assert.notDeepEqual(c.deeds, a.deeds);
});

test("the hand moves him at his pace, and a blow of his lands as the hand guides it, five times a man's", () => {
  const scene = sceneOf([1, 1], [1, 1]);
  // A second walked toward the foe, not at a run: his walk and a third, as the bid has it.
  const f = field(12);
  for (let i = 0; i < POSSESS_HZ; i++)
    stepFight(scene, f, { mx: -31, mz: 0, run: false, act: 0 }, drawOf(1));
  assert.ok(Math.abs(f.bodies[0]!.x + FIGHT_PACE.walk * 1.3) < 0.05, `${f.bodies[0]!.x}`);
  // A blow each fresh fight: how often his land, against how often a man's of the fight does.
  let mine = 0,
    theirs = 0;
  const trials = 600;
  for (let k = 0; k < trials; k++) {
    const g = field(1);
    g.bodies[1]!.ready = 1e9; // (the foe strikes no blow back)
    stepFight(scene, g, strike, drawOf(100 + k));
    if (["felled", "wounded", "struck"].includes(toldOf(g)!)) mine++;
    // The same blow struck by the fight itself, the hand let go.
    const h = field(1);
    h.bodies[1]!.ready = 1e9;
    stepFight(scene, h, still, drawOf(100 + k), false);
    if (h.bodies[1]!.struck >= 0) theirs++;
  }
  assert.ok(Math.abs(mine / trials - FIGHT_HIT.hand) < 0.06, `his land ${mine} of ${trials}`);
  assert.ok(
    Math.abs(theirs / trials - FIGHT_HIT.blow) < 0.03,
    `a man's land ${theirs} of ${trials}`,
  );
});

test("a people of another world fights at its own paces: a shelled one's slower, a feathered one's faster", () => {
  const walked = (pace?: number) => {
    const scene = { ...sceneOf([1, 1], [1, 1]), ...(pace === undefined ? {} : { pace }) },
      f = field(30);
    for (let i = 0; i < POSSESS_HZ; i++)
      stepFight(scene, f, { mx: -31, mz: 0, run: false, act: 0 }, drawOf(1));
    return -f.bodies[0]!.x;
  };
  const shell = personFrame({ ...plan0, clade: "turtle", skin: "shell" } as BodyPlan)!,
    feathers = personFrame({ ...plan0, clade: "bird", skin: "feathers" } as BodyPlan)!;
  assert.ok(shell.run < 1 && feathers.run > 1, `${shell.run} ${feathers.run}`);
  assert.ok(Math.abs(walked(shell.run) - walked() * shell.run) < 0.05, `${walked(shell.run)}`);
  assert.ok(Math.abs(walked(feathers.run) - walked() * feathers.run) < 0.05);
});

test("the god's hand wards the body it holds: a blow on him kills half as often and takes less out of him", () => {
  const scene = sceneOf([1, 1], [1, 1]);
  /** Every blow lands where the draw of 0.5 lays it; kills where the kill's draw is under its share. */
  const drawWith =
    (kill: number): LocalDraw =>
    (_s, _step, purpose) =>
      purpose === FIGHT_DRAWS.hit
        ? 0
        : purpose === FIGHT_DRAWS.kill
          ? kill
          : purpose === FIGHT_DRAWS.cut
            ? 0.999
            : 0.5;
  /** The foe's blow on him, held or not (he strikes none). */
  const blow = (held: boolean, kill: number) => {
    const f = field(1);
    f.bodies[0]!.ready = 1e9;
    stepFight(scene, f, still, drawWith(kill), held);
    return f.bodies[0]!;
  };
  /** The highest kill draw that still kills (the blow's share that kills). */
  const share = (held: boolean) => {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (blow(held, mid).doing === "dead") lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const free = share(false),
    warded = share(true);
  assert.ok(free > 0.01, `a blow kills ${free} of the time`);
  assert.ok(Math.abs(warded / free - FIGHT_WARD.kill) < 1e-6, `${warded} against ${free}`);
  // A blow that does not kill: what it takes out of him.
  const hurt = blow(false, 0.999),
    held = blow(true, 0.999),
    place = BLOW_PLACES[hurt.struck]!;
  assert.equal(held.struck, hurt.struck, "struck in the same place");
  assert.ok(hurt.hurt > 0 && hurt.hurt <= Math.max(...Object.values(FIGHT_HURT)), place);
  assert.ok(Math.abs(held.hurt - hurt.hurt * FIGHT_WARD.hurt) < 1e-12, `${held.hurt} ${hurt.hurt}`);
});

test("the four acts before him: a blow (or what his side looses where none is in reach), a parry, a rally, flight", () => {
  const near = field(1),
    scene = sceneOf([1, 1], [1, 1]);
  assert.deepEqual(
    fightOffers(scene, near).map((o) => [o.kind, o.can, o.why]),
    [
      ["strike", true, ""],
      ["parry", true, ""],
      ["rally", true, ""],
      ["fly", true, ""],
    ],
  );
  // Struck: too soon for another; rallied: too soon to rally again.
  const f = field(1);
  stepFight(scene, f, strike, drawOf(7));
  stepFight(scene, f, { ...still, act: FIGHT_ACT.rally }, drawOf(7));
  assert.deepEqual(
    fightOffers(scene, f).map((o) => o.why),
    ["soon", "", "soon", ""],
  );
  assert.equal(toldOf(f), "rallied");
  // Far off: no blow reaches; where his side looses arrows, he looses.
  const far = field(30);
  assert.deepEqual(fightOffers(scene, far)[0], {
    act: HAND_ACT.strike,
    kind: "strike",
    can: false,
    why: "reach",
  });
  const archers: FightScene = { ...scene, sides: [scene.sides[0], side(1, 1, "arrows")] },
    loosing = fightWorld([
      fightBody(0, 1, { x: 0, z: 0, yaw: 0 }, 1, true),
      fightBody(1, 0, { x: -30, z: 0, yaw: 0 }, 1, false),
    ]);
  assert.deepEqual(
    [fightOffers(archers, loosing)[0]!.kind, fightOffers(archers, loosing)[0]!.can],
    ["loose", true],
  );
  stepFight(archers, loosing, strike, drawOf(7));
  assert.ok(["loosed", "missed", "felled", "wounded", "struck"].includes(toldOf(loosing)!));
  // In flight: the fourth is a stand.
  const fleeing = field(6);
  stepFight(scene, fleeing, { ...still, act: FIGHT_ACT.fly }, drawOf(7));
  assert.equal(toldOf(fleeing), "fled");
  assert.equal(fightOffers(scene, fleeing)[3]!.kind, "stand");
});

test("a side breaks where its heart fails, and his fight ends where he falls, flees the field, or the day is done", () => {
  const scene = sceneOf([1, 1], [1, 1]),
    f = field(6);
  f.bodies[1]!.doing = "dead";
  stepFight(scene, f, still, drawOf(9));
  assert.equal(f.broke, 0, "the attackers' one man down: they break");
  assert.equal(toldOf(f), "beaten");
  // He flees off the defenders' flank before a town, and is gone.
  const g = field(30);
  for (let i = 0; i < 40 * POSSESS_HZ && !g.ended; i++)
    stepFight(scene, g, { mx: 0, mz: 31, run: true, act: i === 0 ? FIGHT_ACT.fly : 0 }, drawOf(9));
  assert.equal(g.ended, "fled");
  // The day's end.
  const late: FightScene = { ...scene, from: 149.9 },
    h = field(30);
  for (let i = 0; i < 4; i++) stepFight(late, h, still, drawOf(9));
  assert.equal(h.ended, "over");
});

test("where a blow lands, by its weights: the first place with weight past the draw", () => {
  const w = placeWeights("dead", "hand", "edge", true);
  assert.equal(w.length, BLOW_PLACES.length);
  assert.equal(blowPlaceOf(w, 0), BLOW_PLACES[w.findIndex((x) => x > 0)]);
  assert.equal(blowPlaceOf(w, 0.999999), BLOW_PLACES[w.findLastIndex((x) => x > 0)]);
});

const body = (
  size: number,
  moves: CreatureBody["moves"],
  eats: CreatureBody["eats"],
  features: string[] = [],
): CreatureBody =>
  ({
    symmetry: "bilateral",
    segments: 1,
    legs: 4,
    fins: 0,
    wings: moves === "fly" ? 2 : 0,
    covering: "fur",
    size,
    moves,
    eats,
    level: eats === "flesh" ? 3 : 2,
    neck: 0.4,
    tail: 0.3,
    features,
    warm: true,
  }) as unknown as CreatureBody;

test("a beast moves and acts by its body: its weight, how it goes, what it eats, what it bears", () => {
  const ox = wildFrame(body(300, "walk", "grass", ["horns"]), "grazer"),
    hare = wildFrame(body(3, "hop", "grass"), "seed-eater"),
    cat = wildFrame(body(150, "run", "flesh", ["claws"]), "hunter"),
    crow = wildFrame(body(1, "fly", "carrion", ["beak"]), "scavenger"),
    snake = wildFrame(body(4, "slither", "flesh"), "small hunter");
  assert.ok(ox.walk > hare.walk && ox.run > ox.walk * 1.5, "the great walk the farther");
  assert.ok(snake.walk < hare.walk, "a slither is slow");
  assert.deepEqual([ox.bite, cat.bite, crow.bite], ["point", "edge", "point"]);
  assert.deepEqual(
    [ox.herds, ox.hunts, cat.hunts, cat.herds, crow.flies],
    [true, false, true, false, true],
  );
  assert.ok(ox.might > cat.might && cat.might > hare.might);
});

/** A herd of grazers (kind 0) about (0, 0), a cat (kind 1) of no herd; water at (30, 0). */
function meadow(): { scene: WildScene; bodies: number[] } {
  const scene: WildScene = {
    kinds: [
      { frame: wildFrame(body(300, "walk", "grass"), "grazer"), niche: "grazer" },
      { frame: wildFrame(body(150, "run", "flesh", ["claws"]), "hunter"), niche: "hunter" },
    ],
    herds: [{ x: 0, z: 0, flock: true }],
    water: { x: 30, z: 0, r: 4 },
    pasture: { x: 0, z: 0, r: 30 },
    x: 0,
    z: 0,
  };
  const bodies = [0, 0, 0, 0, 0, 0];
  for (let i = 1; i < 8; i++) bodies.push(i, 0, 0, Math.cos(i) * 6, Math.sin(i) * 6, 0);
  bodies.push(900000, 1, -1, 40, 40, 0);
  return { scene, bodies };
}
const toldW = (w: { told: number[] }) => WILD_TOLD[w.told[0]!];

test("a grazer held grazes, drinks at the water, calls its herd about it, and strays from it", () => {
  const { scene, bodies } = meadow(),
    w = wildWorld(unpackWild(bodies)),
    d = drawOf(5);
  assert.deepEqual(
    wildOffers(scene, w).map((o) => [o.kind, o.can]),
    [
      ["graze", true],
      ["drink", false],
      ["herd", true],
      ["flee", true],
    ],
  );
  const fed = w.fed;
  stepWild(scene, w, { ...still, act: WILD_ACT.eat }, d);
  assert.equal(toldW(w), "grazed");
  assert.ok(w.fed > fed);
  stepWild(scene, w, { ...still, act: WILD_ACT.drink }, d);
  assert.equal(toldW(w), "nothing", "no water near");
  stepWild(scene, w, { ...still, act: WILD_ACT.herd }, d);
  assert.equal(toldW(w), "called");
  assert.equal(w.told[3], 7, "its seven heard it");
  for (let i = 0; i < 20; i++) stepWild(scene, w, still, d);
  assert.ok(
    w.bodies.slice(1, 8).every((b) => b.doing === "follow"),
    "they come about it",
  );
  // To the water, at a walk.
  for (let i = 0; i < 40 * POSSESS_HZ && Math.hypot(w.bodies[0]!.x - 30, w.bodies[0]!.z) > 10; i++)
    stepWild(scene, w, { mx: 31, mz: 0, run: false, act: 0 }, d);
  stepWild(scene, w, { ...still, act: WILD_ACT.drink }, d);
  assert.equal(toldW(w), "drank");
  // Its herd followed it: not strayed. Run off alone (the herd no longer called), it is.
  assert.ok(!strayed(scene, w));
  const lone = wildWorld(unpackWild(bodies));
  for (let i = 0; i < 60 * POSSESS_HZ && !strayed(scene, lone); i++)
    stepWild(scene, lone, { mx: 0, mz: -31, run: true, act: 0 }, d);
  const m = herdMiddle(scene, lone)!;
  assert.ok(Math.hypot(lone.bodies[0]!.x - m.x, lone.bodies[0]!.z - m.z) > WILD_STRAY);
  assert.ok(strayed(scene, lone));
  // Never farther than its bounds from where it was taken.
  for (let i = 0; i < 200 * POSSESS_HZ && !lone.ended; i++)
    stepWild(scene, lone, { mx: 0, mz: -31, run: true, act: 0 }, d);
  assert.equal(lone.ended, "far");
  assert.ok(Math.hypot(lone.bodies[0]!.x, lone.bodies[0]!.z) <= WILD_BOUNDS + 1);
});

test("a hunter held springs on its prey, eats at the kill, and its prey's herd starts off from it at a run", () => {
  const { scene, bodies } = meadow();
  // The cat first, by the herd.
  const cat = bodies.slice(-6);
  cat[3] = 4;
  cat[4] = 0;
  const w = wildWorld(unpackWild([...cat, ...bodies.slice(0, -6)])),
    // (Its spring always takes what it springs on.)
    sure: LocalDraw = () => 0;
  assert.deepEqual(
    wildOffers(scene, w).map((o) => o.kind),
    ["hunt", "eat", "drink", "flee"],
  );
  stepWild(scene, w, { mx: -31, mz: 0, run: true, act: 0 }, sure);
  assert.ok(
    w.bodies.some((b) => b.doing === "flee"),
    "those near start off from a hunter come at a run",
  );
  let k = 0;
  while (toldW(w) !== "killed" && k++ < 200)
    stepWild(scene, w, { mx: -31, mz: 0, run: true, act: WILD_ACT.hunt }, sure);
  assert.equal(toldW(w), "killed");
  const kill = w.deeds.find((x) => x.kind === "killed")!;
  assert.equal(w.bodies.find((b) => b.id === kill.id)!.doing, "dead");
  const fed = w.fed;
  stepWild(scene, w, { ...still, act: WILD_ACT.eat }, sure);
  assert.equal(toldW(w), "ate");
  assert.ok(w.fed > fed);
});

const plan0: BodyPlan = {
  clade: "ape",
  name: "upright apes",
  medium: "land",
  symmetry: "bilateral",
  size: 60,
  manipulators: "hands",
  limbs: 2,
  senses: ["sight", "hearing", "smell"],
  skin: "skin",
  warm: true,
  diet: "both",
  bearing: "live",
  young: 1,
  span: 70,
  social: 0.7,
};

test("a people of another world moves by its own body; an upright ape with hands as Phase 60 moves one", () => {
  assert.equal(personFrame(null), null);
  assert.equal(personFrame({ ...plan0, clade: "ape", manipulators: "hands" }), null);
  const plan: BodyPlan = {
      clade: "cephalopod",
      name: "deep-sea thinkers",
      medium: "water",
      symmetry: "bilateral",
      size: 45,
      manipulators: "tentacles",
      limbs: 8,
      senses: ["sight", "electric"],
      skin: "skin",
      warm: false,
      diet: "flesh",
      bearing: "spawn",
      young: 40,
      span: 30,
      social: 0.4,
    },
    f = personFrame(plan)!;
  assert.ok(f, "a frame of its own");
  assert.equal(f.bare.blow, "crush", "tentacles crush");
  assert.ok(f.strength >= 0.5 && f.strength <= 2);
  assert.deepEqual(f.anatomy, anatomyOf(plan));
  assert.ok(f.run < 1.25, "a swimmer of the deep slower ashore than an ape");
  // Where a blow lands on it: the nines laid on what it has, each of them somewhere it has.
  const w = landsOn(f.anatomy),
    nines = landsOn(anatomyOf(plan0));
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - nines.reduce((a, b) => a + b, 0)) < 1e-9);
  assert.ok(w.every((x, i) => x === 0 || f.anatomy.members.includes(MEMBERS[i]!)));
});
