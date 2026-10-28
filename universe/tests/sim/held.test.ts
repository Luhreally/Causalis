// Phase 61: the god's hand in a soldier of a battle fought before a town, and in a beast of a town's
// flock or of the wild — taken by command, stepped a second at a time by the page's bids, let go;
// what the hand's fight decided written into the war against the same fight left to itself; a
// beast run off lost to its flock, one of the wild killed off its land's count. A world where none
// is held keeps every hash.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Hasher,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import {
  FIGHT_EVENTS,
  HandStore,
  WILD_EVENTS,
  WILD_KILL,
  battleBy,
  foughtOn,
  handDay,
  handOf,
  makePopulationWorld,
  politiesOf,
  populationContext,
  warsOf,
  wildsOf,
  type BeastArgs,
  type FightIdle,
  type SoldierArgs,
} from "../../src/sim/index.ts";
import {
  FIGHT_ACT,
  FIGHT_LAST,
  HAND_ACT,
  POSSESS_HZ,
  WILD_ACT,
  bidLetters,
  fightDecided,
  type HandBid,
} from "../../src/rules/index.ts";

const seed = seedFromText("first light"),
  build = () => makePopulationWorld(seed, { start: "spread" }),
  domain = (w: World, name: string) => w.domainHashes().find(([d]) => d === name)?.[1];
type Battle = NonNullable<ReturnType<typeof battleBy>>["b"];

/**
 * A world come to the morning a battle `ok` takes is fought before its town (the first such of a
 * year from 30), `second` battle seconds in: the moment before.
 */
function comeTo(
  ok: (b: Battle) => boolean,
  second = 20,
): { world: World; event: string; year: number } {
  const world = build();
  for (let y = 30; y <= 70; y++) {
    world.runTo((y + 1) * YEAR + 1);
    for (const w of warsOf(world).all())
      for (const b of w.battles)
        if (b.year === y && b.fielded && b.fell && ok(b)) {
          world.runTo((y + 1) * YEAR + 8 * 3600 + second * 60 - 1);
          return { world, event: b.event, year: y };
        }
  }
  throw new Error("no such battle");
}
const sizeable = (b: Battle) => Math.min(...b.fielded!) >= 60;

type Laid = { side: 0 | 1; x: number; z: number; u?: number };
/** The field as a page lays it: he first, `per` men a figure (as many figures a side as it fielded, 120 at most). */
function argsOf(b: Battle, bodies: readonly Laid[], ids = 0): SoldierArgs {
  const most = 120,
    per = Math.max(1, Math.ceil(Math.max(...b.fielded!) / most)),
    figures = [0, 1].map((s) => Math.max(1, Math.round(b.fielded![s]! / per))) as [number, number];
  return {
    battle: b.event,
    most,
    per,
    meet: 0,
    figure: ids,
    side: bodies[0]!.side,
    ref: `lv:test:${ids}`,
    name: "Ardo",
    town: "Kesh",
    looses: ["none", "none"],
    mounted: [false, false],
    figures,
    before: [0, 0],
    bodies: bodies.flatMap((l, i) => [
      ids + i,
      l.side,
      l.x,
      l.z,
      l.side === 1 ? -Math.PI / 2 : Math.PI / 2,
      l.u ?? 0.5,
    ]),
    refs: bodies.map((_, i) => `lv:test:${ids + i}`),
    names: bodies.map((_, i) => `Man ${ids + i}`),
  };
}
/** Two lines meeting: he a defender in the middle of the front rank, the attackers' front `gap` metres before it. */
function lines(gap: number, each = 40): Laid[] {
  const out: Laid[] = [{ side: 1, x: 0, z: 0 }];
  for (let k = 1; k < each; k++)
    out.push({ side: 1, x: Math.floor(k / 20) * 1.6, z: ((k % 20) - 10) * 1.2 || 13 });
  for (let k = 0; k < each; k++)
    out.push({ side: 0, x: -gap - Math.floor(k / 20) * 1.6, z: ((k % 20) - 10) * 1.2 });
  return out;
}
function take(world: World, args: SoldierArgs): void {
  world.runTo(world.submit("possess.soldier", args).t);
}
/** A second of bids, sent as the page sends them: at the moment of the battle second they begin. */
function send(world: World, bids: readonly HandBid[]): boolean {
  const h = handOf(world).held;
  if (!h || h.kind !== "soldier") return false;
  world.runTo(Math.max(world.now, h.from + (h.fight.step / POSSESS_HZ) * 60 - 1));
  const c = world.submit("possess.held", {
    step: h.fight.step,
    steps: bids.map(bidLetters).join(""),
  });
  world.runTo(c.t);
  return true;
}
function leave(world: World): void {
  const h = handOf(world).held;
  if (!h) return;
  const c = world.submit("possess.leave", {
    step: h.kind === "soldier" ? h.fight.step : h.wild.step,
    steps: "",
  });
  world.runTo(c.t);
}
const bid = (act = 0, mx = 0, mz = 0, run = false): HandBid => ({ mx, mz, run, act });
/** A second of the fight as a player fights it: a blow as often as one may fall, a parry between. */
const fighting: HandBid[] = Array.from({ length: POSSESS_HZ }, (_, i) =>
  bid(i % 12 === 0 ? HAND_ACT.strike : FIGHT_ACT.parry),
);
const foughtEvent = (world: World) =>
  world.events.all().findLast((e) => e.type === FIGHT_EVENTS.fought.type)!.data as {
    turned: boolean;
    won: boolean;
    attackerWon: boolean;
    felled: number;
    wounded: number;
    fallen: [number, number];
    was: [number, number];
    fate: string;
    after: string;
    ended: string;
  };

test("the day as the hand's fight leaves it, against the same fight left alone", () => {
  const b = {
      won: true,
      fallen: [40, 90] as [number, number],
      fielded: [500, 300] as [number, number],
    },
    idle = (beaten: -1 | 0 | 1, dead: [number, number]): FightIdle => ({
      beaten,
      dead,
      down: [0, 0],
    });
  // Nothing changed: history's to the man.
  assert.deepEqual(handDay(b, idle(1, [5, 9]), idle(1, [5, 9]), 4), {
    won: true,
    turned: false,
    fallen: [40, 90],
  });
  // His blows broke the attackers where the fight left alone broke the defenders, as history did:
  // turned, and each side's fallen moved by the bodies more or fewer struck dead, so many men each.
  assert.deepEqual(handDay(b, idle(1, [5, 9]), idle(0, [8, 6]), 4), {
    won: false,
    turned: true,
    fallen: [52, 78],
  });
  // The fight left alone went against history: where the hand changed nothing, history stands; where
  // his fight came out as history had it, history stands too (it does not turn back on itself).
  assert.equal(handDay(b, idle(0, [5, 9]), idle(0, [5, 9]), 4).won, true);
  assert.deepEqual(handDay(b, idle(0, [8, 6]), idle(1, [5, 9]), 4).won, true);
  assert.equal(handDay(b, idle(0, [8, 6]), idle(1, [5, 9]), 4).turned, false);
  // Neither broke left alone (history's stands for it): his fight breaking the attackers turns it.
  assert.equal(handDay(b, idle(-1, [5, 9]), idle(0, [5, 9]), 4).turned, true);
  assert.equal(handDay(b, idle(-1, [5, 9]), idle(-1, [9, 9]), 4).turned, false);
  // Never fewer than none, nor more than a side fielded.
  assert.deepEqual(handDay(b, idle(1, [50, 0]), idle(1, [0, 900]), 4).fallen, [0, 300]);
});

test("a world where no soldier or beast is held keeps its hand's hash and its save as they were", () => {
  const store = new HandStore(),
    h = new Hasher(),
    old = new Hasher();
  store.hashInto(h);
  old.value(null);
  assert.equal(h.hex(), old.hex());
  assert.deepEqual(store.save(), { resting: null });
  store.load({ resting: null });
  assert.equal(store.held, null);
  assert.deepEqual([store.fought, store.strays], [[], []]);
});

test("a soldier is taken only while his battle is fought, once, one body at a time; refused in plain words", () => {
  const { world, event } = comeTo(sizeable, -30),
    b = battleBy(world, event)!.b;
  const why = (w: World, type: string, args: unknown): string => {
    try {
      w.submit(type, args);
    } catch (e) {
      return (e as Error).message;
    }
    return "";
  };
  assert.match(why(world, "possess.soldier", argsOf(b, lines(2))), /that battle has not begun/);
  world.runTo((b.year + 1) * YEAR + 8 * 3600 + FIGHT_LAST * 60 + 60);
  assert.match(
    why(world, "possess.soldier", argsOf(b, lines(2))),
    /that battle is decided: the beaten are put to flight/,
  );
  const { world: w2, event: e2 } = comeTo(sizeable);
  const b2 = battleBy(w2, e2)!.b;
  assert.match(
    why(w2, "possess.soldier", { ...argsOf(b2, lines(2)), figure: 7 }),
    /he is the first of the bodies/,
  );
  assert.match(
    why(w2, "possess.soldier", { ...argsOf(b2, lines(2)), battle: "ev:0:1" }),
    /no battle ev:0:1/,
  );
  take(w2, argsOf(b2, lines(2)));
  assert.match(
    why(w2, "possess.soldier", argsOf(b2, lines(2))),
    /your hand is in a body already: let it go first/,
  );
  assert.match(why(w2, "possess.held", { step: 3, steps: "" }), /out of step: it stands at step 0/);
  leave(w2);
  assert.match(
    why(w2, "possess.soldier", argsOf(b2, lines(2))),
    /the god has fought in that battle already/,
  );
  assert.match(
    why(w2, "possess.held", { step: 0, steps: "" }),
    /your hand is in no soldier or beast/,
  );
});

test("a soldier taken and let go at once: history's battle to the man, the land's people as they were", () => {
  const { world, event } = comeTo(sizeable),
    twin = build(),
    was = battleBy(world, event)!.b;
  twin.runTo(world.now);
  take(world, argsOf(was, lines(6)));
  const h = handOf(world).held!;
  assert.equal(h.kind, "soldier");
  assert.equal(h.kind === "soldier" && h.fight.bodies.length, 80);
  leave(world);
  assert.equal(handOf(world).held, null);
  const after = battleBy(world, event)!.b,
    told = foughtEvent(world);
  assert.equal(after.won, was.won);
  assert.deepEqual(after.fallen, was.fallen);
  assert.equal(told.turned, false);
  assert.deepEqual(told.fallen, was.fallen);
  assert.equal(told.ended, "let go");
  const fought = handOf(world).foughtOf(event)!;
  assert.equal(fought.was.event, event);
  assert.equal(fought.left.step, 0);
  world.runTo(world.now + 30 * 86_400);
  twin.runTo(world.now);
  for (const d of ["population", "polity", "economy"])
    assert.equal(domain(world, d), domain(twin, d), `${d} as it was`);
});

test("his blows move the tally: so many more of the foe fallen as his fight struck down more than it would have", () => {
  const { world, event } = comeTo(sizeable),
    twin = build(),
    was = battleBy(world, event)!.b;
  twin.runTo(world.now);
  take(world, argsOf(was, lines(1.2)));
  const held = handOf(world).held!,
    idle = held.kind === "soldier" ? held.idle : null,
    per = held.kind === "soldier" ? held.per : 0;
  assert.ok(idle && per >= 1);
  for (let s = 0; s < 30 && send(world, fighting); s++);
  leave(world);
  const after = battleBy(world, event)!.b,
    told = foughtEvent(world),
    fought = handOf(world).foughtOf(event)!,
    out = fightDecided(foughtOn(world, fought)),
    day = handDay(was, idle!, out, per);
  assert.ok(told.felled + told.wounded >= 1, `he struck down ${told.felled} and ${told.wounded}`);
  assert.deepEqual(after.fallen, day.fallen, "the fallen as the hand's day has them");
  assert.equal(after.won, day.won);
  assert.notDeepEqual(after.fallen, was.fallen, "the tally moved");
  // The war's own tally with it, and the lands' people: more dead (or fewer) than history's.
  const war = warsOf(world)
      .all()
      .find((w) => w.battles.some((x) => x.event === event))!,
    warTwin = warsOf(twin)
      .all()
      .find((w) => w.ref === war.ref)!;
  assert.deepEqual(
    [war.fallen[0] - warTwin.fallen[0], war.fallen[1] - warTwin.fallen[1]],
    [after.fallen[0] - was.fallen[0], after.fallen[1] - was.fallen[1]],
  );
  twin.runTo(world.now);
  assert.notEqual(domain(world, "population"), domain(twin, "population"));
  // Told as the god's act: what he did by his own hand, how it ended for him, and after.
  assert.ok(["fell", "wounded", "lived"].includes(told.fate));
  assert.deepEqual(told.was, was.fallen);
});

test("the hand can turn the day: history's beaten win it, and the land it was fought for is theirs again", () => {
  const { world, event } = comeTo((b) => b.won && !b.seat && sizeable(b)),
    was = battleBy(world, event)!.b,
    war = warsOf(world)
      .all()
      .find((w) => w.battles.some((x) => x.event === event))!,
    realms = politiesOf(world);
  assert.ok(realms.get(war.attacker)!.members.includes(was.land), "history's victors hold it");
  const ruleset = rulesetId(world, "test"),
    before = saveWorld(world, ruleset);
  // He alone of the defenders against one of theirs: left alone the fight goes history's way more
  // often than not; under the hand, his blows land five times as often and theirs on him less. Of
  // a few such fields, one where it turns.
  let turned: World | null = null;
  for (let k = 0; k < 10 && !turned; k++) {
    const w = loadWorld(before, build, ruleset).world;
    take(
      w,
      argsOf(
        was,
        [
          { side: 1, x: 0, z: 0, u: 0.5 },
          { side: 0, x: -1.2, z: 0, u: 0.5 },
        ],
        100 * k,
      ),
    );
    for (let s = 0; s < 40 && send(w, fighting); s++);
    leave(w);
    if (foughtEvent(w).turned) turned = w;
  }
  assert.ok(turned, "the hand turned one of ten");
  const after = battleBy(turned, event)!.b,
    told = foughtEvent(turned);
  assert.equal(after.won, false, "the attackers lost it");
  assert.equal(told.won, true, "his side won the day");
  const r = politiesOf(turned);
  assert.ok(r.get(war.defender)!.members.includes(was.land), "the land given back");
  assert.ok(!r.get(war.attacker)!.members.includes(was.land));
  // Told: history turned.
  assert.ok(turned.events.all().some((e) => e.type === FIGHT_EVENTS.fought.type));
});

test("saved with a soldier held, it loads as it was and goes on as it would have; replayed from its seed, the same", () => {
  const { world, event } = comeTo(sizeable),
    was = battleBy(world, event)!.b;
  take(world, argsOf(was, lines(1.5)));
  send(world, fighting);
  send(world, fighting);
  const ruleset = rulesetId(world, "test"),
    held = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(held, build), { ok: true, problem: null });
  const loaded = loadWorld(held, build, ruleset).world;
  for (const w of [world, loaded]) {
    for (let s = 0; s < 3; s++) send(w, fighting);
    leave(w);
    w.runTo(w.now + 2 * 86_400);
  }
  assert.deepEqual(
    loaded.checkpoints().map((c) => c.chain),
    world.checkpoints().map((c) => c.chain),
  );
  assert.deepEqual(battleBy(loaded, event)!.b.fallen, battleBy(world, event)!.b.fallen);
  assert.deepEqual(verifyByReplay(saveWorld(world, ruleset), build), { ok: true, problem: null });
});

/** A town of the world and two of its land's lineages: one that grazes, one that hunts. */
function beastsOf(world: World) {
  const c = populationContext(world),
    v = [...c.settlements.all()].sort((a, b) => b.population - a.population)[0]!,
    grazer = c.generated.life.species.find((s) => s.body && s.niche === "grazer")!,
    hunter = c.generated.life.species.find((s) => s.body && s.niche === "hunter")!;
  return { c, v, grazer, hunter };
}
function sendBeast(world: World, bids: readonly HandBid[]): boolean {
  const h = handOf(world).held;
  if (!h || h.kind !== "beast") return false;
  const c = world.submit("possess.held", {
    step: h.wild.step,
    steps: bids.map(bidLetters).join(""),
  });
  world.runTo(c.t);
  return true;
}

test("a beast of a town's flock run off from its herd and let go: lost to the flock a year, told", () => {
  const world = build();
  world.runTo(40 * YEAR + 3600);
  const { v, grazer } = beastsOf(world),
    bodies: number[] = [],
    members: number[] = [];
  for (let i = 0; i < 8; i++) {
    bodies.push(i, 0, 0, i ? Math.cos(i) * 5 : 0, i ? Math.sin(i) * 5 : 0, 0);
    members.push(i);
  }
  const args: BeastArgs = {
    village: v.ref,
    name: `a ${grazer.name} of ${v.name}'s flock`,
    kinds: [grazer.ref],
    bodies,
    members,
    herds: [0, 0, 1],
    water: [],
    pasture: [0, 0, 30],
  };
  world.runTo(world.submit("possess.beast", args).t);
  assert.equal(handOf(world).held?.kind, "beast");
  // It grazes, then runs off south at a run until it is far from its herd.
  sendBeast(world, [bid(WILD_ACT.eat), ...Array.from({ length: POSSESS_HZ - 1 }, () => bid())]);
  for (let s = 0; s < 16; s++)
    sendBeast(
      world,
      Array.from({ length: POSSESS_HZ }, () => bid(0, 0, -31, true)),
    );
  leave(world);
  const strays = handOf(world).strays;
  assert.deepEqual(
    strays.map((s) => [s.village, s.member, s.how]),
    [[v.ref, 0, "strayed"]],
  );
  assert.equal(handOf(world).straysOf(v.ref, world.now).length, 1);
  assert.equal(handOf(world).straysOf(v.ref, world.now + YEAR).length, 0, "a year on, drawn again");
  const ran = world.events.all().findLast((e) => e.type === WILD_EVENTS.ran.type)!.data as {
    strayed: boolean;
    ate: number;
    seconds: number;
  };
  assert.equal(ran.strayed, true);
  assert.equal(ran.ate, 1);
  assert.equal(ran.seconds, 17);
});

test("a hunter of the wild held springs on the wild's game: one killed is so much off its land's count", () => {
  const world = build(),
    twin = build();
  world.runTo(40 * YEAR + 3600);
  twin.runTo(world.now);
  const { c, v, grazer, hunter } = beastsOf(world),
    args: BeastArgs = {
      village: v.ref,
      name: `a ${hunter.name}`,
      kinds: [grazer.ref, hunter.ref],
      bodies: [900000, 1, -1, 0, 0, 0, 1, 0, 0, 1.5, 0, 0, 2, 0, 0, 30, 30, 0],
      members: [-1, -1, -1],
      herds: [20, 20, 0],
      water: [],
      pasture: [],
    };
  const wildBefore = wildsOf(c, v.cell).wild;
  world.runTo(world.submit("possess.beast", args).t);
  let killed = 0;
  for (let s = 0; s < 10 && !killed; s++) {
    sendBeast(world, [bid(WILD_ACT.hunt), ...Array.from({ length: POSSESS_HZ - 1 }, () => bid())]);
    const h = handOf(world).held;
    killed = h?.kind === "beast" ? h.wild.deeds.filter((d) => d.kind === "killed").length : 0;
  }
  assert.equal(killed, 1, "it took one");
  leave(world);
  twin.runTo(world.now);
  const after = wildsOf(populationContext(world), v.cell).wild,
    alone = wildsOf(populationContext(twin), v.cell).wild;
  assert.ok(
    Math.abs(alone - after - Math.min(WILD_KILL, alone)) < 1e-12,
    `${alone} → ${after} (${wildBefore})`,
  );
  assert.equal(handOf(world).strays.length, 0, "none of a flock's lost");
  assert.equal(domain(world, "population"), domain(twin, "population"));
  const ran = world.events.all().findLast((e) => e.type === WILD_EVENTS.ran.type)!.data as {
    killed: number;
    wild: number;
  };
  assert.deepEqual([ran.killed, ran.wild], [1, 1]);
});
